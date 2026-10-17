package com.yacc.api.connector;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.api.audit.AuditRecord;
import com.yacc.api.conversation.ConversationAccessService;
import com.yacc.api.conversation.ConversationIngressService;
import com.yacc.api.message.MessageService;
import com.yacc.api.queue.QueueRetryProperties;
import com.yacc.api.queue.QueueRetryService;
import com.yacc.api.queue.RetryDeliveryHandler.RetryOutcome;
import com.yacc.api.realtime.MessageFailedPayload;
import com.yacc.api.realtime.MessageReceivedPayload;
import com.yacc.api.realtime.MessageSentPayload;
import com.yacc.api.realtime.RealtimeEvents;
import com.yacc.api.realtime.RealtimeRooms;
import com.yacc.api.realtime.WebSocketEnvelope;
import com.yacc.api.realtime.WebSocketEventPublisher;
import com.yacc.entity.Message;
import com.yacc.entity.MessageStatus;
import com.yacc.service.AuditPersistence;
import com.yacc.service.DlqService;

import jakarta.annotation.PreDestroy;

/**
 * The gateway exchange (MIG-062; ADR-022 used-surface parity; the Java
 * re-expression of the POC {@code gateway-exchange}) — the unified
 * orchestration point of the connector message flow in both directions,
 * fail-closed (GOV-038):
 *
 * <ul>
 *   <li><b>inbound (D2)</b> — the merged connector intake seams
 *       ({@link TelegramUpdateReceiver}/{@link IrcMessageReceiver}) land
 *       here: validate &rarr; conversation find-or-create + auto-reopen +
 *       activity refresh (the conversation module's public ingress API)
 *       &rarr; inbound message persist (the message module's public API)
 *       &rarr; enveloped {@code message.received} to the conversation room
 *       &rarr; best-effort system-actor {@code message.ingested} audit.
 *       Baseline inbound DLQ was a placeholder-id insert that violated the
 *       frozen FKs and was swallowed — deliberately not replicated (MIG-063
 *       evidence); a failed ingestion fails closed with a typed error
 *       log.</li>
 *   <li><b>outbound (D3)</b> — the {@link com.yacc.api.message.MessageCreatedEvent}
 *       trigger dispatches asynchronously after the frozen 201/PENDING
 *       response path (guardrail G8): breaker gate &rarr; registry lookup
 *       &rarr; connector send &rarr; status transition + {@code message.sent}
 *       / {@code message.failed} (both broadcast — baseline
 *       {@code queue-database-integration} {@code emitGlobally} parity; the
 *       tracker's own emitter was a no-op stub) &rarr; on failure a DLQ entry
 *       with real identities + {@code queue.message.dlq} + the retry cycle
 *       via {@code QueueRetryService.scheduleCycle} (guardrail G7 — the
 *       once-only {@code retry_attempt} flag is never touched) +
 *       {@code message.retry.scheduled}.</li>
 *   <li><b>redelivery (D4)</b> — the production redelivery logic behind the
 *       {@link GatewayRedeliveryHandler} seam bean: one {@code deliver} =
 *       exactly one attempt with the same
 *       status/emission/accounting semantics; duplicates are tolerated (a
 *       message already {@code sent} collapses to success without a connector
 *       call — the documented idempotence boundary, MIG-063's handler
 *       contract). Failure counting stays single-sourced in the connector
 *       hook path (guardrail G6 — the exchange never counts failures); the
 *       breaker is consulted before every dispatch and reset by
 *       {@code recordSuccess} on a delivered send and by the connector
 *       status &rarr; {@code connected} transition
 *       ({@link ConnectorStatusBroadcaster}, the un-wedge path).</li>
 * </ul>
 *
 * <p>The {@code QueueRetryService} dependency is resolved through
 * {@link ObjectProvider}: the worker's delivery seam IS this exchange while
 * the exchange's failure path schedules cycles on the worker (guardrail G7)
 * — a deliberate, documented cycle broken lazily at wiring time without
 * touching the merged MIG-063 constructor.</p>
 */
@Service
public class GatewayExchange implements TelegramUpdateReceiver, IrcMessageReceiver {

    private static final Logger log = LoggerFactory.getLogger(GatewayExchange.class);

    /** Initial-dispatch DLQ failure reason (free-form REST-DLQ filter value). */
    static final String SEND_FAILED_REASON = "SEND_FAILED";

    private final ConnectorRegistry registry;

    private final ConnectorCircuitBreaker breaker;

    private final ConversationIngressService conversationIngress;

    private final ConversationAccessService conversationAccess;

    private final MessageService messages;

    private final DlqService dlq;

    private final ObjectProvider<QueueRetryService> retryQueue;

    private final QueueRetryProperties retryProperties;

    private final AuditPersistence audit;

    private final WebSocketEventPublisher publisher;

    private final ObjectMapper mapper;

    /**
     * The non-blocking dispatch executor (guardrail G8): dispatch happens
     * after the response path exactly as the baseline fire-and-forget
     * {@code dispatchToConnector}; errors are logged, never returned.
     */
    private final ExecutorService dispatchExecutor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "connector-dispatch");
        thread.setDaemon(true);
        return thread;
    });

    public GatewayExchange(ConnectorRegistry registry, ConnectorCircuitBreaker breaker,
            ConversationIngressService conversationIngress,
            ConversationAccessService conversationAccess, MessageService messages,
            DlqService dlq, ObjectProvider<QueueRetryService> retryQueue,
            QueueRetryProperties retryProperties, AuditPersistence audit,
            WebSocketEventPublisher publisher, ObjectMapper mapper) {
        this.registry = registry;
        this.breaker = breaker;
        this.conversationIngress = conversationIngress;
        this.conversationAccess = conversationAccess;
        this.messages = messages;
        this.dlq = dlq;
        this.retryQueue = retryQueue;
        this.retryProperties = retryProperties;
        this.audit = audit;
        this.publisher = publisher;
        this.mapper = mapper;
    }

    @PreDestroy
    void shutdownDispatcher() {
        dispatchExecutor.shutdownNow();
    }

    // --- inbound half (D2) ---

    /** The Telegram intake seam — normalized updates land in the exchange. */
    @Override
    public void onInboundMessage(TelegramInboundMessage message) {
        handleInbound(new ConnectorInboundMessage(message.platform(), message.externalThreadId(),
                null, message.senderExternalUserId(), message.senderDisplayName(),
                message.body(), message.receivedAt(), message.correlationId()));
    }

    /** The IRC intake seam — normalized PRIVMSG/NOTICE land in the exchange. */
    @Override
    public void onInboundMessage(IrcInboundMessage message) {
        handleInbound(new ConnectorInboundMessage(message.platform(), message.externalThreadId(),
                message.profileId(), message.senderExternalUserId(), message.senderDisplayName(),
                message.body(), message.receivedAt(), message.correlationId()));
    }

    /**
     * One inbound connector message (baseline {@code handleInbound} flow
     * parity). Never throws into the connector (the intake seams' contract —
     * baseline ingestion-error parity): a failure fails closed with a typed
     * error log and is observable there.
     */
    private void handleInbound(ConnectorInboundMessage event) {
        try {
            validateInbound(event);
            UUID conversationId = conversationIngress.findOrCreateForInbound(event.platform(),
                    event.externalThreadId(), event.ircProfileId());
            Message message = messages.createInbound(conversationId, event.senderId(),
                    event.senderName(), event.body(), event.correlationId());
            publishMessageReceived(conversationId, message, event);
            auditIngestion(conversationId, message, event);
            log.info("Inbound connector message processed (platform={}, conversationId={},"
                            + " messageId={}, correlationId={})", event.platform(), conversationId,
                    message.getId(), event.correlationId());
        } catch (RuntimeException failure) {
            log.error("Inbound connector message failed (fail-closed; platform={},"
                            + " externalThreadId={}, correlationId={}): {}", event.platform(),
                    event.externalThreadId(), event.correlationId(), failure.toString());
        }
    }

    /** Baseline {@code validateInboundEvent} parity (fail-closed). */
    private static void validateInbound(ConnectorInboundMessage event) {
        if (event.platform() == null || event.platform().isBlank()) {
            throw new IllegalArgumentException("Missing platform in inbound event");
        }
        if (event.externalThreadId() == null || event.externalThreadId().isBlank()) {
            throw new IllegalArgumentException("Missing externalThreadId in inbound event");
        }
        if (event.senderId() == null || event.senderId().isBlank()) {
            throw new IllegalArgumentException("Missing sender id in inbound event");
        }
        if (event.body() == null || event.body().isBlank()) {
            throw new IllegalArgumentException("Missing or empty body in inbound event");
        }
        if (event.receivedAt() == null) {
            throw new IllegalArgumentException("Missing receivedAt in inbound event");
        }
    }

    /** Enveloped {@code message.received} to the conversation room (G4/G5). */
    private void publishMessageReceived(UUID conversationId, Message message,
            ConnectorInboundMessage event) {
        MessageReceivedPayload payload = new MessageReceivedPayload(message.getId(),
                conversationId, event.platform(), event.senderId(), event.senderName(),
                event.body(), event.receivedAt());
        publisher.publishToRoom(RealtimeRooms.conversation(conversationId.toString()),
                WebSocketEnvelope.of(RealtimeEvents.MESSAGE_RECEIVED, mapper.valueToTree(payload)));
    }

    /** Best-effort system-actor {@code message.ingested} audit (G9). */
    private void auditIngestion(UUID conversationId, Message message,
            ConnectorInboundMessage event) {
        ObjectNode metadata = mapper.createObjectNode()
                .put("conversationId", conversationId.toString())
                .put("platform", event.platform())
                .put("externalThreadId", event.externalThreadId())
                .put("senderId", event.senderId());
        if (event.correlationId() != null) {
            metadata.put("correlationId", event.correlationId().toString());
        }
        audit.persist(new AuditRecord("message.ingested", "message",
                message.getId().toString(), null, metadata, null));
    }

    // --- outbound half (D3) + redelivery seam (D4) ---

    /**
     * The {@link com.yacc.api.message.MessageCreatedEvent} listener: submits
     * the dispatch to the executor so it runs after the frozen 201/PENDING
     * response path (guardrail G8; baseline non-blocking
     * {@code dispatchToConnector} parity). {@code fallbackExecution} keeps
     * the trigger live when no transaction is active.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onMessageCreated(com.yacc.api.message.MessageCreatedEvent event) {
        dispatchOutbound(event.messageId());
    }

    /**
     * Fire-and-forget outbound dispatch (baseline parity: errors are logged,
     * never returned to the REST caller).
     */
    public void dispatchOutbound(UUID messageId) {
        dispatchExecutor.execute(() -> {
            try {
                attemptDelivery(messageId, false);
            } catch (RuntimeException failure) {
                log.error("Outbound dispatch failed for {}: {}", messageId,
                        failure.toString());
            }
        });
    }

    /**
     * One redelivery attempt (D4), exercised by the
     * {@link GatewayRedeliveryHandler} seam bean: duplicate-tolerant (a
     * message already {@code sent} collapses to success without a connector
     * call — the documented idempotence boundary).
     */
    public RetryOutcome deliver(UUID messageId) {
        try {
            return attemptDelivery(messageId, true);
        } catch (RuntimeException failure) {
            return RetryOutcome.failure(failure.toString());
        }
    }

    /**
     * One delivery attempt (baseline {@code handleOutbound} parity): load
     * the message and its conversation routing, consult the breaker (open
     * &rarr; fail fast, no connector call, no extra failure count — G6),
     * resolve the adapter (absent &rarr; fail closed, no fallback — G3),
     * send, then transition the status and emit.
     */
    private RetryOutcome attemptDelivery(UUID messageId, boolean redelivery) {
        Message message = messages.findForDispatch(messageId).orElse(null);
        if (message == null) {
            log.warn("Dispatch target message {} no longer exists (fail-closed)", messageId);
            return RetryOutcome.failure("message not found: " + messageId);
        }
        if (message.getStatus() == MessageStatus.SENT) {
            // Duplicate-tolerance boundary: already delivered — never re-send.
            log.info("Dispatch of {} skipped: the message is already sent", messageId);
            return RetryOutcome.success();
        }
        var routing = conversationAccess.routingOf(message.getConversationId()).orElse(null);
        if (routing == null) {
            return recordFailure(message, "Conversation not found: "
                    + message.getConversationId(), redelivery);
        }
        String platform = routing.channel();
        if (breaker.isOpen(platform)) {
            // G6 fail-fast: no connector call, no extra failure count.
            return recordFailure(message,
                    "Circuit breaker open for platform " + platform + " — dispatch refused",
                    redelivery);
        }
        PlatformConnector connector = registry.get(platform).orElse(null);
        if (connector == null) {
            return recordFailure(message, "No connector registered for platform: " + platform,
                    redelivery);
        }
        ConnectorOutboundMessage outbound = new ConnectorOutboundMessage(
                message.getConversationId().toString(), routing.externalThreadId(),
                message.getBody(), correlationOf(message));
        ConnectorSendResult result = connector.sendMessage(outbound);
        if (result.success()) {
            messages.markSent(messageId, result.externalMessageId());
            breaker.recordSuccess(platform);
            publishToAll(RealtimeEvents.MESSAGE_SENT, mapper.valueToTree(new MessageSentPayload(
                    messageId, message.getConversationId(), "sent", result.sentAt())));
            log.info("Outbound message delivered (messageId={}, platform={},"
                            + " externalMessageId={})", messageId, platform,
                    result.externalMessageId());
            return RetryOutcome.success();
        }
        return recordFailure(message, result.error().code() + ": " + result.error().message(),
                redelivery);
    }

    /**
     * The failure accounting (baseline failure-path parity): status
     * &rarr; {@code failed} with error/correlation metadata; the enveloped
     * {@code message.failed} with the truthful attempt/retryAt derivation of
     * {@link MessageFailedPayload} (a terminal exhausted failure emits
     * nothing — E3 posture); on the initial dispatch also the DLQ entry with
     * real identities (FK fail-closed, G7), the {@code queue.message.dlq}
     * emission and the retry cycle + {@code message.retry.scheduled}.
     */
    private RetryOutcome recordFailure(Message message, String error, boolean redelivery) {
        messages.markFailed(message.getId(), error);
        int attempt;
        LocalDateTime retryAt = null;
        if (redelivery) {
            int cycleAttempt = dlq.findByMessageId(message.getId())
                    .map(dlq::retryCycleAttempt).orElse(0);
            attempt = cycleAttempt + 1;
            if (cycleAttempt < retryProperties.maxAttempts()) {
                retryAt = LocalDateTime.now()
                        .plusNanos(retryProperties.delayBeforeAttempt(cycleAttempt + 1) * 1_000_000);
            }
        } else {
            attempt = 1;
            retryAt = LocalDateTime.now()
                    .plusNanos(retryProperties.delayBeforeAttempt(1) * 1_000_000);
        }
        if (retryAt != null) {
            publishToAll(RealtimeEvents.MESSAGE_FAILED,
                    mapper.valueToTree(new MessageFailedPayload(message.getId(),
                            message.getConversationId(), "failed", error, retryAt, attempt)));
        } else {
            log.warn("Terminal redelivery failure of {} (cycle attempt exhausted) —"
                    + " no retry follows, message.failed is not emitted (frozen schema requires"
                    + " a truthful retryAt; E3 posture); the DLQ terminal state is the"
                    + " observable record", message.getId());
        }
        if (!redelivery) {
            enqueueDlqEntry(message, error);
            publishToAll(RealtimeEvents.QUEUE_MESSAGE_DLQ, dlqPayload(message, error));
            try {
                retryQueue.getObject().scheduleCycle(message.getId());
                publishToAll(RealtimeEvents.MESSAGE_RETRY_SCHEDULED,
                        retryScheduledPayload(message, retryAt));
            } catch (RuntimeException failure) {
                log.error("Retry-cycle scheduling failed for {} (the DLQ entry and the"
                        + " manual re-queue remain the recovery path): {}", message.getId(),
                        failure.toString());
            }
        }
        log.warn("Outbound message failed (messageId={}, redelivery={}, error={})",
                message.getId(), redelivery, error);
        return RetryOutcome.failure(error);
    }

    /**
     * The message-correlated DLQ entry (guardrail G7): real
     * {@code messageId}/{@code conversationId} identities — the frozen FKs
     * are the fail-closed guard. The once-only {@code retry_attempt} flag is
     * never touched (the P0 manual-retry gate); automatic retry is the
     * scheduled Quartz cycle.
     */
    private void enqueueDlqEntry(Message message, String error) {
        ObjectNode payload = mapper.createObjectNode()
                .put("messageId", message.getId().toString())
                .put("conversationId", message.getConversationId().toString())
                .put("body", message.getBody())
                .put("direction", "outbound");
        if (message.getMetadata() != null) {
            try {
                JsonNode metadata = mapper.readTree(message.getMetadata());
                payload.set("metadata", metadata);
            } catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException ignored) {
                // unparseable metadata carries no dispatch context
            }
        }
        ObjectNode metadata = mapper.createObjectNode()
                .put("source", "gateway-exchange");
        dlq.enqueue(message.getId(), message.getConversationId(), payload.toString(),
                SEND_FAILED_REASON, 1, error, correlationOf(message), metadata.toString());
    }

    private ObjectNode dlqPayload(Message message, String error) {
        ObjectNode payload = mapper.createObjectNode()
                .put("messageId", message.getId().toString())
                .put("conversationId", message.getConversationId().toString())
                .put("failureReason", SEND_FAILED_REASON)
                .put("totalAttempts", 1)
                .put("lastError", error)
                .put("requiresReview", true);
        String correlationId = correlationOf(message);
        if (correlationId != null) {
            payload.put("correlationId", correlationId);
        }
        return payload;
    }

    private ObjectNode retryScheduledPayload(Message message, LocalDateTime nextRetryAt) {
        ObjectNode payload = mapper.createObjectNode()
                .put("messageId", message.getId().toString())
                .put("conversationId", message.getConversationId().toString())
                .put("attempt", 1);
        if (nextRetryAt != null) {
            payload.put("nextRetryTime", nextRetryAt.toString());
        }
        return payload;
    }

    private void publishToAll(String event, JsonNode data) {
        publisher.publishToAll(WebSocketEnvelope.of(event, data));
    }

    /** Reads the send correlation id from the message metadata (or null). */
    private String correlationOf(Message message) {
        if (message.getMetadata() == null || message.getMetadata().isBlank()) {
            return null;
        }
        try {
            JsonNode metadata = mapper.readTree(message.getMetadata());
            JsonNode correlationId = metadata.get("correlationId");
            return correlationId == null || correlationId.isNull()
                    ? null
                    : correlationId.asText();
        } catch (RuntimeException
                | com.fasterxml.jackson.core.JsonProcessingException malformed) {
            return null;
        }
    }
}
