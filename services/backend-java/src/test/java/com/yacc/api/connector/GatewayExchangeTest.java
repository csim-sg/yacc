package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.beans.factory.ObjectProvider;

import com.fasterxml.jackson.databind.JsonNode;
import com.yacc.api.conversation.ConversationAccessService;
import com.yacc.api.conversation.ConversationIngressService;
import com.yacc.api.message.MessageService;
import com.yacc.api.queue.QueueRetryProperties;
import com.yacc.api.queue.QueueRetryService;
import com.yacc.api.realtime.RealtimeEvents;
import com.yacc.api.realtime.RealtimeRooms;
import com.yacc.api.realtime.WebSocketEnvelope;
import com.yacc.api.realtime.WebSocketEventPublisher;
import com.yacc.entity.Message;
import com.yacc.entity.MessageDirection;
import com.yacc.entity.MessageStatus;
import com.yacc.service.AuditPersistence;
import com.yacc.service.DlqService;

/**
 * MIG-062 exchange unit tests (guardrails G3/G6/G7 — fail-closed branches,
 * single-sourced failure counting, breaker fail-fast, truthful E3 emission
 * posture, duplicate tolerance). The full data-layer behavior is exercised
 * by the integration tests in this package.
 */
class GatewayExchangeTest {

    private static final UUID CONVERSATION_ID =
            UUID.fromString("00000000-0000-0000-0000-00000000e001");
    private static final UUID MESSAGE_ID =
            UUID.fromString("00000000-0000-0000-0000-00000000e002");

    private ConnectorRegistry registry;
    private ConnectorCircuitBreaker breaker;
    private ConversationIngressService conversationIngress;
    private ConversationAccessService conversationAccess;
    private MessageService messages;
    private DlqService dlq;
    private QueueRetryService retryQueue;
    private AuditPersistence audit;
    private WebSocketEventPublisher publisher;
    private PlatformConnector telegram;
    private GatewayExchange exchange;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        registry = mock(ConnectorRegistry.class);
        breaker = new ConnectorCircuitBreaker();
        conversationIngress = mock(ConversationIngressService.class);
        conversationAccess = mock(ConversationAccessService.class);
        messages = mock(MessageService.class);
        dlq = mock(DlqService.class);
        ObjectProvider<QueueRetryService> retryProvider = mock(ObjectProvider.class);
        retryQueue = mock(QueueRetryService.class);
        when(retryProvider.getObject()).thenReturn(retryQueue);
        audit = mock(AuditPersistence.class);
        publisher = mock(WebSocketEventPublisher.class);
        telegram = mock(PlatformConnector.class);
        exchange = new GatewayExchange(registry, breaker, conversationIngress,
                conversationAccess, messages, dlq, retryProvider,
                new QueueRetryProperties(null, null, null), audit, publisher,
                new com.fasterxml.jackson.databind.ObjectMapper()
                        .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
                        .disable(com.fasterxml.jackson.databind.SerializationFeature
                                .WRITE_DATES_AS_TIMESTAMPS));
    }

    private Message outbound(MessageStatus status) {
        Message message = new Message(MESSAGE_ID, CONVERSATION_ID, "sender-1", "Sender",
                "hello", MessageDirection.OUTBOUND);
        message.setStatus(status);
        return message;
    }

    private void routeExists() {
        when(messages.findForDispatch(MESSAGE_ID)).thenReturn(Optional.of(outbound(
                MessageStatus.PENDING)));
        when(conversationAccess.routingOf(CONVERSATION_ID)).thenReturn(Optional.of(
                new ConversationAccessService.ConversationRouting(CONVERSATION_ID,
                        "telegram", "12345")));
        when(registry.get("telegram")).thenReturn(Optional.of(telegram));
    }

    // --- inbound (D2) ---

    @Test
    void malformedInboundFailsClosedWithoutAnyPersistence() {
        exchange.onInboundMessage(new IrcInboundMessage("irc", " ", "nick", "nick",
                "hello", LocalDateTime.now(), UUID.randomUUID(), "raw", 7));

        verifyNoInteractions(conversationIngress, messages, publisher, audit);
    }

    @Test
    void inboundComposesIngressPersistEmissionAndAudit() {
        Message inbound = new Message(MESSAGE_ID, CONVERSATION_ID, "tg-user", "Tg User",
                "hello", MessageDirection.INBOUND);
        inbound.setStatus(MessageStatus.SENT);
        when(conversationIngress.findOrCreateForInbound("telegram", "12345", null))
                .thenReturn(CONVERSATION_ID);
        when(messages.createInbound(CONVERSATION_ID, "tg-user", "Tg User", "hello", null))
                .thenReturn(inbound);

        exchange.onInboundMessage(new TelegramInboundMessage("telegram", "12345", "tg-user",
                "Tg User", "hello", LocalDateTime.now(), null, "{}"));

        verify(messages).createInbound(CONVERSATION_ID, "tg-user", "Tg User", "hello", null);
        ArgumentCaptor<WebSocketEnvelope> envelope = ArgumentCaptor
                .forClass(WebSocketEnvelope.class);
        verify(publisher).publishToRoom(
                eq(RealtimeRooms.conversation(CONVERSATION_ID.toString())),
                envelope.capture());
        assertThat(envelope.getValue().event()).isEqualTo(RealtimeEvents.MESSAGE_RECEIVED);
        assertThat(envelope.getValue().data().get("platform").asText()).isEqualTo("telegram");
        verify(audit).persist(org.mockito.ArgumentMatchers.argThat(record ->
                "message.ingested".equals(record.action())
                        && "message".equals(record.entityType())
                        && record.actorId() == null));
    }

    // --- outbound (D3) fail-closed + accounting ---

    @Test
    void dispatchFailsClosedWhenTheMessageNoLongerExists() {
        when(messages.findForDispatch(MESSAGE_ID)).thenReturn(Optional.empty());

        var outcome = exchange.deliver(MESSAGE_ID);

        assertThat(outcome.delivered()).isFalse();
        verifyNoInteractions(conversationAccess, registry, dlq, publisher);
    }

    @Test
    void unknownConnectorFailsClosedWithTheFullFailurePath() {
        routeExists();
        when(registry.get("telegram")).thenReturn(Optional.empty());

        exchange.dispatchOutbound(MESSAGE_ID);

        // Initial dispatch path (async): DLQ entry + retry cycle are scheduled.
        // The retry-scheduled emission is the task's last observable effect —
        // waiting for it makes the plain verifies below deterministic.
        ArgumentCaptor<WebSocketEnvelope> envelope = ArgumentCaptor
                .forClass(WebSocketEnvelope.class);
        verify(publisher, timeout(2_000).times(3)).publishToAll(envelope.capture());
        assertThat(envelope.getAllValues().stream().map(WebSocketEnvelope::event))
                .containsExactly(RealtimeEvents.MESSAGE_FAILED,
                        RealtimeEvents.QUEUE_MESSAGE_DLQ,
                        RealtimeEvents.MESSAGE_RETRY_SCHEDULED);
        verify(messages).markFailed(eq(MESSAGE_ID), anyString());
        verify(telegram, never()).sendMessage(any());
        verify(dlq).enqueue(eq(MESSAGE_ID), eq(CONVERSATION_ID), anyString(),
                anyString(), eq(1), anyString(), any(), anyString());
        verify(retryQueue).scheduleCycle(MESSAGE_ID);
    }

    @Test
    void breakerOpenFailsFastWithoutAConnectorCallOrAnExtraCount() {
        routeExists();
        // The connector hook path counted 5 consecutive failures.
        for (int failure = 0; failure < 5; failure++) {
            breaker.recordFailure("telegram");
        }
        assertThat(breaker.isOpen("telegram")).isTrue();

        exchange.dispatchOutbound(MESSAGE_ID);

        // Wait for the failed attempt to be fully recorded, then assert the
        // fail-fast properties deterministically.
        ArgumentCaptor<WebSocketEnvelope> envelope = ArgumentCaptor
                .forClass(WebSocketEnvelope.class);
        verify(publisher, timeout(2_000).times(3)).publishToAll(envelope.capture());
        assertThat(envelope.getAllValues().stream().map(WebSocketEnvelope::event))
                .containsExactly(RealtimeEvents.MESSAGE_FAILED,
                        RealtimeEvents.QUEUE_MESSAGE_DLQ,
                        RealtimeEvents.MESSAGE_RETRY_SCHEDULED);
        verify(messages).markFailed(eq(MESSAGE_ID), anyString());
        verify(telegram, never()).sendMessage(any());
        assertThat(breaker.failureCount("telegram")).isEqualTo(5);
    }

    @Test
    void deliveredSendMarksSentEmitsAndResetsTheBreaker() {
        routeExists();
        for (int failure = 0; failure < 3; failure++) {
            breaker.recordFailure("telegram");
        }
        when(telegram.sendMessage(any())).thenReturn(ConnectorSendResult.success("777",
                LocalDateTime.now()));

        var outcome = exchange.deliver(MESSAGE_ID);

        assertThat(outcome.delivered()).isTrue();
        verify(messages).markSent(MESSAGE_ID, "777");
        assertThat(breaker.isOpen("telegram")).isFalse();
        assertThat(breaker.failureCount("telegram")).isZero();
        ArgumentCaptor<WebSocketEnvelope> envelope = ArgumentCaptor
                .forClass(WebSocketEnvelope.class);
        verify(publisher, times(1)).publishToAll(envelope.capture());
        assertThat(envelope.getValue().event()).isEqualTo(RealtimeEvents.MESSAGE_SENT);
        assertThat(envelope.getValue().data().get("status").asText()).isEqualTo("sent");
        verifyNoInteractions(dlq, retryQueue);
    }

    @Test
    void duplicateDeliveryOfAnAlreadySentMessageCollapses() {
        when(messages.findForDispatch(MESSAGE_ID)).thenReturn(Optional.of(outbound(
                MessageStatus.SENT)));

        var outcome = exchange.deliver(MESSAGE_ID);

        assertThat(outcome.delivered()).isTrue();
        verify(telegram, never()).sendMessage(any());
        verify(messages, never()).markSent(any(), anyString());
        verifyNoInteractions(dlq, retryQueue, publisher);
    }

    // --- truthful E3 emission posture + G7 initial-path accounting ---

    @Test
    void nonTerminalRedeliveryFailureEmitsFailedWithTheNextLadderStep() {
        redeliveryInFlight(1);

        var outcome = exchange.deliver(MESSAGE_ID);

        assertThat(outcome.delivered()).isFalse();
        ArgumentCaptor<WebSocketEnvelope> envelope = ArgumentCaptor
                .forClass(WebSocketEnvelope.class);
        verify(publisher).publishToAll(envelope.capture());
        assertThat(envelope.getValue().event()).isEqualTo(RealtimeEvents.MESSAGE_FAILED);
        JsonNode data = envelope.getValue().data();
        assertThat(data.get("attempt").asInt()).isEqualTo(2);
        assertThat(data.get("retryAt").isTextual()).isTrue();
        // The redelivery path only reads the DLQ cycle state (the worker owns
        // every write around the attempt); no enqueue, no re-scheduling.
        verify(dlq, never()).enqueue(any(), any(), anyString(), anyString(), any(),
                anyString(), any(), anyString());
        verifyNoInteractions(retryQueue);
    }

    @Test
    void terminalRedeliveryFailureEmitsNothingAndRecordsTheOutcome() {
        redeliveryInFlight(3);

        var outcome = exchange.deliver(MESSAGE_ID);

        assertThat(outcome.delivered()).isFalse();
        verifyNoInteractions(publisher, retryQueue);
        verify(dlq, never()).enqueue(any(), any(), anyString(), anyString(), any(),
                anyString(), any(), anyString());
        verify(messages).markFailed(eq(MESSAGE_ID), anyString());
    }

    private void redeliveryInFlight(int cycleAttempt) {
        Message message = outbound(MessageStatus.FAILED);
        when(messages.findForDispatch(MESSAGE_ID)).thenReturn(Optional.of(message));
        when(conversationAccess.routingOf(CONVERSATION_ID)).thenReturn(Optional.of(
                new ConversationAccessService.ConversationRouting(CONVERSATION_ID,
                        "telegram", "12345")));
        when(registry.get("telegram")).thenReturn(Optional.of(telegram));
        var entry = mock(com.yacc.entity.DeadLetterQueueEntry.class);
        when(dlq.findByMessageId(MESSAGE_ID)).thenReturn(Optional.of(entry));
        when(dlq.retryCycleAttempt(entry)).thenReturn(cycleAttempt);
        when(telegram.sendMessage(any())).thenReturn(ConnectorSendResult.failure(
                ConnectorSendResult.SendError.of(ConnectorErrorCode.NETWORK_ERROR,
                        "transport down"), LocalDateTime.now()));
    }
}
