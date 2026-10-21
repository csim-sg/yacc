package com.yacc.common.contract;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.yacc.api.realtime.ConnectorRelayService;
import com.yacc.api.realtime.MessageFailedPayload;
import com.yacc.api.realtime.MessageReceivedPayload;
import com.yacc.api.realtime.MessageSentPayload;
import com.yacc.api.realtime.WebSocketEventPublisher;
import com.yacc.api.realtime.OnlineUsersPayload;
import com.yacc.api.realtime.PresenceUpdatedPayload;
import com.yacc.api.realtime.RealtimeEvents;
import com.yacc.api.realtime.SystemErrorDetail;
import com.yacc.api.realtime.SystemEventPayload;
import com.yacc.api.realtime.TypingStartedPayload;
import com.yacc.api.realtime.TypingStoppedPayload;
import com.yacc.api.realtime.UserStatusChangedPayload;
import com.yacc.api.realtime.WebSocketEnvelope;
import com.yacc.api.realtime.WebSocketInboundFrame;

/**
 * MIG-041 real-time contract conformance, Java model side (AC-MIG-041-1;
 * SPEC-002 AC-02; ADR-023/ADR-026): the implemented real-time models must
 * serialize to JSON that validates against the frozen AsyncAPI JSON Schemas
 * ({@code schemas/*.schema.json}, the binding pair of
 * {@code asyncapi.yaml} per LEDGER-MIG-003-RECONCILED).
 *
 * <p>Covered here (the models MIG-050 implemented):</p>
 * <ul>
 *   <li>the outbound {@code {event,data,timestamp}} envelope
 *       (envelope.schema.json; WS-BHV-001 §4.1);</li>
 *   <li>the {@code system.*} payload model (system-payload.schema.json;
 *       WS-EVT-014/018 canonical shapes, incl. the SystemPayload error
 *       detail);</li>
 *   <li>the bare inbound demux frame data against a frozen per-channel
 *       payload schema (message-sent.schema.json; §4.6 bounded
 *       clarification);</li>
 *   <li>the frozen schema file set itself (every classpath copy parses and
 *       declares the 2020-12 dialect and an object root).</li>
 * </ul>
 *
 * <p>MIG-051 extension: the per-event payload emitters it owns —
 * {@code presence.updated} (presence-updated.schema.json, WS-EVT-009,
 * canonicalization §4.5), {@code typing.started}/{@code typing.stopped}
 * (typing-*.schema.json, WS-EVT-010/011) and the new system-family
 * emitters (heartbeat/reconnection/backlog_replay types, WS-EVT-015..020) —
 * validate against the same frozen schemas; the raw
 * {@code online.users}/{@code user.status.changed} reply/broadcast shapes
 * (WS-RAW-006/007) have no frozen schema file and are asserted member-wise.</p>
 *
 * <p>Transport-frame conventions stay in
 * {@code RealtimeTransportContractAlignmentTest} (MIG-050).</p>
 */
@Tag("contract")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AsyncApiRealtimePayloadConformanceTest {

    /** The frozen envelope member set (schemas/envelope.schema.json). */
    private static final Set<String> ENVELOPE_MEMBERS = Set.of("event", "data", "timestamp");

    /**
     * MIG-102: the production Jackson wire posture ({@code JacksonConfig}
     * customizer via {@link ProductionJacksonPosture}) — no test-only
     * override. The envelope {@code timestamp} ({@code Instant}) serializes
     * as RFC 3339 UTC under the same posture as the REST date-time members.
     */
    private final ObjectMapper mapper = ProductionJacksonPosture.productionMapper();

    private Map<String, JsonSchema> payloadSchemas;

    /**
     * MIG-091c (#452): the corrected inline {@code reaction.count} payloads,
     * read from the frozen classpath mirror {@code /contract/asyncapi.yaml}
     * (the channel's inbound publish payload and the outbound
     * {@code ReactionCountPayload} component — neither has a schema file).
     */
    private JsonSchema reactionCountInboundSchema;
    private JsonNode reactionCountInboundPayload;
    private JsonSchema reactionCountOutboundSchema;
    private JsonNode reactionCountOutboundPayload;

    @BeforeAll
    void loadPayloadSchemas() throws IOException {
        payloadSchemas = new LinkedHashMap<>();
        for (String name : List.of(
                "envelope", "conversation-updated", "message-received", "message-sent",
                "message-failed", "notification", "presence-updated", "typing-started",
                "typing-stopped", "reaction-added", "reaction-removed", "system-payload")) {
            try (InputStream schema = getClass()
                    .getResourceAsStream("/contract/schemas/" + name + ".schema.json")) {
                assertThat(schema)
                        .as("frozen %s.schema.json on the test classpath", name).isNotNull();
                JsonNode node = mapper.readTree(schema);
                assertThat(node.path("$schema").asText())
                        .as("%s.schema.json declares the frozen dialect", name)
                        .isEqualTo("https://json-schema.org/draft/2020-12/schema");
                assertThat(node.path("type").asText())
                        .as("%s.schema.json roots at an object", name).isEqualTo("object");
                // The frozen files carry a non-URI `$id` shorthand
                // (`yacc/ws/<name>.schema.json`); the validator requires an
                // absolute URI base, so it is removed in-memory only — the
                // frozen files themselves are never rewritten.
                ((ObjectNode) node).remove("$id");
                payloadSchemas.put(name, JsonSchemaFactory
                        .getInstance(SpecVersion.VersionFlag.V202012)
                        .getSchema(node, SchemaValidatorsConfig.builder()
                                .formatAssertionsEnabled(Boolean.TRUE)
                                .build()));
            }
        }

        // MIG-091c (#452; founder decision 2026-10-21 — #366 comment 6310022755):
        // load the inline reaction.count payloads from the frozen classpath
        // mirror so the corrected inbound publish payload and the unchanged
        // outbound component are both validated where they are declared.
        try (InputStream contract = getClass()
                .getResourceAsStream("/contract/asyncapi.yaml")) {
            assertThat(contract)
                    .as("frozen asyncapi.yaml on the test classpath").isNotNull();
            JsonNode root = new ObjectMapper(new YAMLFactory()).readTree(contract);
            reactionCountInboundPayload = root.path("channels").path("reaction.count")
                    .path("publish").path("message").path("payload");
            reactionCountOutboundPayload = root.path("components").path("messages")
                    .path("ReactionCountPayload").path("payload");
            assertThat(reactionCountInboundPayload.isObject())
                    .as("channels.reaction.count.publish.message.payload is inline")
                    .isTrue();
            assertThat(reactionCountOutboundPayload.isObject())
                    .as("components.messages.ReactionCountPayload.payload is inline")
                    .isTrue();
            reactionCountInboundSchema = inlineSchema(reactionCountInboundPayload);
            reactionCountOutboundSchema = inlineSchema(reactionCountOutboundPayload);
        }
    }

    @Test
    void outboundEnvelopeModelValidatesAgainstTheFrozenEnvelopeSchema() {
        WebSocketEnvelope envelope = WebSocketEnvelope.of(
                RealtimeEvents.MESSAGE_SENT,
                mapper.createObjectNode().put("messageId", "m-1"));

        JsonNode wire = mapper.valueToTree(envelope);
        assertThat(errors("envelope", wire)).isEmpty();

        // Verbatim member set + RFC 3339 UTC timestamp at emit time
        // (WS-BHV-001). MIG-102: the emitted value is asserted, not just the
        // member's presence — the envelope {@code timestamp} is an
        // {@code Instant} and must carry the explicit UTC offset on the wire
        // (the frozen envelope schema also enforces {@code format: date-time}
        // with format assertions on above).
        assertThat(wire.fieldNames()).toIterable().containsExactlyInAnyOrderElementsOf(
                ENVELOPE_MEMBERS);
        assertThat(wire.path("event").asText()).isEqualTo("message.sent");
        assertThat(wire.path("timestamp").asText())
                .as("envelope timestamp is RFC 3339 with an explicit UTC offset")
                .matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z");
    }

    @Test
    void systemPayloadModelValidatesAgainstTheFrozenSystemPayloadSchema() {
        JsonNode connectionEstablished = mapper.valueToTree(
                SystemEventPayload.of(SystemEventPayload.TYPE_CONNECTION_ESTABLISHED));
        assertThat(errors("system-payload", connectionEstablished)).isEmpty();

        // MIG-051 emitters of the remaining frozen system types (WS-EVT-015..020).
        JsonNode heartbeat = mapper.valueToTree(SystemEventPayload.of(
                SystemEventPayload.TYPE_HEARTBEAT));
        assertThat(errors("system-payload", heartbeat)).isEmpty();
        JsonNode reconnection = mapper.valueToTree(SystemEventPayload.of(
                SystemEventPayload.TYPE_RECONNECTION));
        assertThat(errors("system-payload", reconnection)).isEmpty();
        JsonNode backlogReplay = mapper.valueToTree(SystemEventPayload.of(
                SystemEventPayload.TYPE_BACKLOG_REPLAY));
        assertThat(errors("system-payload", backlogReplay)).isEmpty();

        JsonNode error = mapper.valueToTree(SystemEventPayload.error(
                "internal_error", "handler failed"));
        assertThat(errors("system-payload", error)).isEmpty();
        assertThat(error.path("error").path("code").asText()).isEqualTo("internal_error");
        assertThat(new SystemErrorDetail("internal_error", "handler failed").code())
                .isEqualTo("internal_error");
    }

    @Test
    void presenceUpdatedPayloadValidatesAgainstTheFrozenCanonicalSchema() {
        // WS-EVT-009 / canonicalization §4.5: one canonical shape for ALL
        // outbound presence emissions.
        PresenceUpdatedPayload payload = new PresenceUpdatedPayload(
                "00000000-0000-4000-8000-000000000001",
                PresenceUpdatedPayload.STATUS_ONLINE,
                java.time.Instant.now());

        JsonNode wire = mapper.valueToTree(payload);
        assertThat(errors("presence-updated", wire)).isEmpty();

        // Canonical member set; lastSeen is RFC 3339 UTC through the
        // production posture (the frozen schema declares
        // format: date-time with format assertions on).
        assertThat(wire.fieldNames()).toIterable()
                .containsExactlyInAnyOrder("userId", "status", "lastSeen");
        assertThat(wire.path("lastSeen").asText())
                .matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z");

        // The retired baseline value is refused by the frozen enum.
        JsonNode away = mapper.createObjectNode()
                .put("userId", "00000000-0000-4000-8000-000000000001")
                .put("status", "away")
                .put("lastSeen", wire.path("lastSeen").asText());
        assertThat(errors("presence-updated", away)).isNotEmpty();
    }

    @Test
    void typingPayloadsValidateAgainstTheFrozenChannelSchemas() {
        JsonNode started = mapper.valueToTree(new TypingStartedPayload(
                "00000000-0000-4000-8000-000000000002",
                "00000000-0000-4000-8000-000000000001",
                "Alice"));
        assertThat(errors("typing-started", started)).isEmpty();
        assertThat(started.fieldNames()).toIterable()
                .containsExactlyInAnyOrder("conversationId", "userId", "name");

        JsonNode stopped = mapper.valueToTree(new TypingStoppedPayload(
                "00000000-0000-4000-8000-000000000002",
                "00000000-0000-4000-8000-000000000001"));
        assertThat(errors("typing-stopped", stopped)).isEmpty();
        assertThat(stopped.fieldNames()).toIterable()
                .containsExactly("conversationId", "userId");
    }

    @Test
    void rawPresenceReplyAndStatusShapesCarryTheirFrozenMembers() {
        // WS-RAW-006/007: raw baseline reply/broadcast payloads (no frozen
        // schema file) — member-wise shape pins.
        JsonNode onlineUsers = mapper.valueToTree(new OnlineUsersPayload(
                List.of("00000000-0000-4000-8000-000000000001"),
                java.time.Instant.now()));
        assertThat(onlineUsers.fieldNames()).toIterable()
                .containsExactlyInAnyOrder("users", "timestamp");
        assertThat(onlineUsers.path("timestamp").asText())
                .matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z");

        JsonNode statusChanged = mapper.valueToTree(new UserStatusChangedPayload(
                "00000000-0000-4000-8000-000000000001",
                UserStatusChangedPayload.STATUS_AWAY,
                java.time.Instant.now()));
        assertThat(statusChanged.fieldNames()).toIterable()
                .containsExactlyInAnyOrder("userId", "status", "timestamp");
        assertThat(statusChanged.path("timestamp").asText())
                .matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z");
    }

    @Test
    void inboundFramePayloadValidatesAgainstTheFrozenChannelPayloadSchema() {
        // §4.6: inbound client→server frames are {event, data} with a BARE
        // payload — the per-channel JSON Schema describes `data`.
        JsonNode sentData = mapper.createObjectNode()
                .put("messageId", "00000000-0000-4000-8000-000000000001")
                .put("conversationId", "00000000-0000-4000-8000-000000000002")
                .put("status", "sent")
                .put("sentAt", "2026-10-16T08:00:00.000Z");
        WebSocketInboundFrame frame = new WebSocketInboundFrame(
                RealtimeEvents.MESSAGE_SENT, sentData);

        JsonNode wire = mapper.valueToTree(frame);
        assertThat(wire.has("timestamp"))
                .as("inbound frames carry no timestamp (envelope is outbound-only)")
                .isFalse();
        assertThat(errors("message-sent", wire.path("data"))).isEmpty();
    }

    // --- MIG-091c (#452): direction-specific reaction.count conformance.
    // The corrected inline channel payload describes the baseline inbound
    // request; the outbound component is unchanged (AC-2/AC-3/AC-4; founder
    // decision 2026-10-21 — #366 comment 6310022755). ---

    @Test
    void reactionCountInboundPublishPayloadAcceptsTheBaselineShapeWithoutTimestamp() {
        // Declared shape: required [messageId, conversationId, emoji, count]
        // and no timestamp member — the baseline inbound request shape
        // (reaction.controller.ts:138 @98db628).
        List<String> required = new ArrayList<>();
        reactionCountInboundPayload.path("required")
                .forEach(n -> required.add(n.asText()));
        assertThat(required).containsExactlyInAnyOrder(
                "messageId", "conversationId", "emoji", "count");
        assertThat(reactionCountInboundPayload.path("properties").has("timestamp"))
                .as("inbound payload declares no timestamp member").isFalse();

        // Baseline-shaped frame without timestamp (and without any extra
        // member) validates with zero errors.
        JsonNode inbound = mapper.createObjectNode()
                .put("messageId", "m-1")
                .put("conversationId", "00000000-0000-4000-8000-000000000002")
                .put("emoji", "👍")
                .put("count", 3);
        assertThat(reactionCountInboundSchema.validate(inbound)).isEmpty();
    }

    @Test
    void reactionCountInboundPublishPayloadRejectsAMissingConversationId() {
        // conversationId is the routing member — a frame without it is rejected.
        JsonNode unroutable = mapper.createObjectNode()
                .put("messageId", "m-1")
                .put("emoji", "👍")
                .put("count", 3);
        Set<ValidationMessage> violations = reactionCountInboundSchema.validate(unroutable);
        assertThat(violations).isNotEmpty();
        assertThat(violations).anySatisfy(message ->
                assertThat(message.getMessage()).contains("conversationId"));
    }

    @Test
    void reactionCountOutboundComponentStaysUnchanged() {
        // The outbound ReactionCountPayload keeps its frozen shape: required
        // [messageId, emoji, count, timestamp], no conversationId member.
        List<String> required = new ArrayList<>();
        reactionCountOutboundPayload.path("required")
                .forEach(n -> required.add(n.asText()));
        assertThat(required).containsExactlyInAnyOrder(
                "messageId", "emoji", "count", "timestamp");
        assertThat(reactionCountOutboundPayload.path("properties").has("conversationId"))
                .as("outbound payload has no conversationId").isFalse();

        // An outbound-shaped sample (RFC 3339 timestamp) still validates.
        JsonNode outbound = mapper.createObjectNode()
                .put("messageId", "m-1")
                .put("emoji", "👍")
                .put("count", 3)
                .put("timestamp", "2026-10-21T10:00:00.000Z");
        assertThat(reactionCountOutboundSchema.validate(outbound)).isEmpty();

        // The timestamp stays required outbound — a frame without it is rejected.
        assertThat(reactionCountOutboundSchema.validate(mapper.createObjectNode()
                .put("messageId", "m-1")
                .put("emoji", "👍")
                .put("count", 3))).isNotEmpty();
    }

    // --- MIG-062 connector-bridge payload emitters (WS-EVT-003/004/005;
    // the gateway exchange is the emitter, the models are wire truth) ---

    @Test
    void messageReceivedPayloadValidatesAgainstTheFrozenSchema() {
        MessageReceivedPayload payload = new MessageReceivedPayload(
                UUID.fromString("00000000-0000-4000-8000-0000000000a1"),
                UUID.fromString("00000000-0000-4000-8000-0000000000a2"),
                "telegram", "555", "Tg User", "hello",
                java.time.LocalDateTime.of(2026, 10, 18, 10, 0, 0));

        JsonNode wire = mapper.valueToTree(payload);
        assertThat(errors("message-received", wire)).isEmpty();
        // Frozen required member set exactly (attachments deliberately absent).
        assertThat(wire.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "messageId", "conversationId", "platform", "senderId", "senderName",
                "body", "timestamp");
        // MIG-102 posture: LocalDateTime members emit RFC 3339 UTC.
        assertThat(wire.path("timestamp").asText())
                .matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z");

        // Fail-closed shape: a blank senderName is a schema violation.
        JsonNode blank = mapper.valueToTree(new MessageReceivedPayload(
                UUID.fromString("00000000-0000-4000-8000-0000000000a1"),
                UUID.fromString("00000000-0000-4000-8000-0000000000a2"),
                "telegram", "555", "", "hello",
                java.time.LocalDateTime.of(2026, 10, 18, 10, 0, 0)));
        assertThat(errors("message-received", blank)).isNotEmpty();
    }

    @Test
    void messageSentPayloadValidatesAgainstTheFrozenSchema() {
        MessageSentPayload payload = new MessageSentPayload(
                UUID.fromString("00000000-0000-4000-8000-0000000000b1"),
                UUID.fromString("00000000-0000-4000-8000-0000000000b2"),
                "sent", java.time.LocalDateTime.of(2026, 10, 18, 10, 0, 0));

        JsonNode wire = mapper.valueToTree(payload);
        assertThat(errors("message-sent", wire)).isEmpty();
        assertThat(wire.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "messageId", "conversationId", "status", "sentAt");
        assertThat(wire.path("status").asText()).isEqualTo("sent");

        // The schema pins the `sent` constant — anything else is a violation.
        JsonNode wrong = mapper.valueToTree(new MessageSentPayload(
                UUID.fromString("00000000-0000-4000-8000-0000000000b1"),
                UUID.fromString("00000000-0000-4000-8000-0000000000b2"),
                "failed", java.time.LocalDateTime.of(2026, 10, 18, 10, 0, 0)));
        assertThat(errors("message-sent", wrong)).isNotEmpty();
    }

    @Test
    void messageFailedPayloadValidatesAgainstTheFrozenSchemaWithTheLadderBounds() {
        MessageFailedPayload payload = new MessageFailedPayload(
                UUID.fromString("00000000-0000-4000-8000-0000000000c1"),
                UUID.fromString("00000000-0000-4000-8000-0000000000c2"),
                "failed", "NETWORK_ERROR: transport down",
                java.time.LocalDateTime.of(2026, 10, 18, 10, 1, 0), 1);

        JsonNode wire = mapper.valueToTree(payload);
        assertThat(errors("message-failed", wire)).isEmpty();
        assertThat(wire.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "messageId", "conversationId", "status", "error", "retryAt", "attempt");
        assertThat(wire.path("retryAt").asText())
                .matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z");

        // attempt is bounded 1..3 by the frozen schema (E3 posture: only
        // attempts with a truthful retryAt are emitted at all).
        assertThat(errors("message-failed", mapper.valueToTree(new MessageFailedPayload(
                UUID.fromString("00000000-0000-4000-8000-0000000000c1"),
                UUID.fromString("00000000-0000-4000-8000-0000000000c2"),
                "failed", "err",
                java.time.LocalDateTime.of(2026, 10, 18, 10, 1, 0), 3)))).isEmpty();
        assertThat(errors("message-failed", mapper.valueToTree(new MessageFailedPayload(
                UUID.fromString("00000000-0000-4000-8000-0000000000c1"),
                UUID.fromString("00000000-0000-4000-8000-0000000000c2"),
                "failed", "err",
                java.time.LocalDateTime.of(2026, 10, 18, 10, 1, 0), 4)))).isNotEmpty();
        assertThat(errors("message-failed", mapper.valueToTree(new MessageFailedPayload(
                UUID.fromString("00000000-0000-4000-8000-0000000000c1"),
                UUID.fromString("00000000-0000-4000-8000-0000000000c2"),
                "failed", "err",
                java.time.LocalDateTime.of(2026, 10, 18, 10, 1, 0), 0)))).isNotEmpty();
    }

    @Test
    void connectorBridgeRawChannelShapesCarryTheirFrozenMembers() {
        // WS-RAW-008/009/012/013: raw baseline emissions (no frozen schema
        // files — AsyncAPI declares {type: object, additionalProperties: true})
        // — the shapes the relay service actually emits, member-wise.
        ObjectMapper mapper = new ObjectMapper();
        WebSocketEventPublisher publisher = org.mockito.Mockito.mock(
                WebSocketEventPublisher.class);
        ConnectorRelayService relay = new ConnectorRelayService(publisher, mapper);

        relay.relayStatusChanged(mapper.createObjectNode()
                .put("platform", "telegram")
                .put("status", "connected")
                .put("timestamp", "2026-10-18T10:00:00Z"));
        org.mockito.ArgumentCaptor<WebSocketEnvelope> captor =
                org.mockito.ArgumentCaptor.forClass(WebSocketEnvelope.class);
        org.mockito.Mockito.verify(publisher).publishToAll(captor.capture());
        org.mockito.Mockito.verify(publisher).publishToRoom(
                org.mockito.ArgumentMatchers.eq("connector:telegram"), captor.capture());
        JsonNode broadcast = captor.getAllValues().get(0).data();
        assertThat(broadcast.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "platform", "status", "timestamp");
        JsonNode room = captor.getAllValues().get(1).data();
        assertThat(room.fieldNames()).toIterable().containsExactly("status", "timestamp");

        org.mockito.Mockito.reset(publisher);
        relay.relayMessageError(mapper.createObjectNode()
                .put("conversationId", UUID.fromString(
                        "00000000-0000-4000-8000-0000000000d1").toString())
                .put("messageId", "m-1")
                .put("platform", "telegram")
                .put("error", "send failed")
                .put("willRetry", true)
                .put("timestamp", "2026-10-18T10:00:00Z"));
        org.mockito.Mockito.verify(publisher).publishToRoom(
                org.mockito.ArgumentMatchers.eq("conversation:00000000-0000-4000-8000-0000000000d1"),
                captor.capture());
        JsonNode error = captor.getValue().data();
        assertThat(error.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "messageId", "error", "willRetry", "timestamp");

        org.mockito.Mockito.reset(publisher);
        relay.relayMessageAck(mapper.createObjectNode()
                .put("conversationId", UUID.fromString(
                        "00000000-0000-4000-8000-0000000000d1").toString())
                .put("messageId", "m-1")
                .put("platform", "telegram")
                .put("platformMessageId", "777")
                .put("timestamp", "2026-10-18T10:00:00Z"));
        org.mockito.Mockito.verify(publisher).publishToRoom(
                org.mockito.ArgumentMatchers.eq("conversation:00000000-0000-4000-8000-0000000000d1"),
                captor.capture());
        JsonNode ack = captor.getValue().data();
        assertThat(ack.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "messageId", "platformMessageId", "timestamp");
    }

    private Set<ValidationMessage> errors(String schemaName, JsonNode instance) {
        return payloadSchemas.get(schemaName).validate(instance);
    }

    private JsonSchema inlineSchema(JsonNode payload) {
        return JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012)
                .getSchema(payload, SchemaValidatorsConfig.builder()
                        .formatAssertionsEnabled(Boolean.TRUE)
                        .build());
    }
}
