package com.yacc.realtime.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.io.Reader;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.yaml.snakeyaml.Yaml;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.node.TextNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.yacc.realtime.model.RealtimeEvents;
import com.yacc.realtime.model.RealtimeRooms;
import com.yacc.realtime.model.RealtimeSession;
import com.yacc.realtime.model.WebSocketEnvelope;
import com.yacc.realtime.model.WebSocketInboundFrame;
import com.yacc.realtime.service.WebSocketEventPublisher;
import com.yacc.realtime.service.WebSocketSessionRegistry;
import com.yacc.realtime.service.YaccWebSocketHandler;

/**
 * MIG-050 transport contract-alignment test (ADR-023 — the frozen AsyncAPI +
 * JSON Schemas are the binding real-time source of truth; review-loop-1
 * tech-lead decision on #354). Asserts the four scoped transport-level frozen
 * invariants directly against the contract files:
 *
 * <ol>
 *   <li>the outbound envelope is {@code {event,data,timestamp}} verbatim
 *       (schemas/envelope.schema.json; §4.1);</li>
 *   <li>{@link RealtimeEvents} is exactly the frozen 23-name canonical set
 *       (§4.2) plus the four frozen ack channels (WS-RAW-002/003/010/011) and
 *       the four frozen inbound channels (WS-OP-CONV-004/005,
 *       WS-OP-CONN-003/004) — every name a real {@code asyncapi.yaml}
 *       channel, and the reconciled ledger carrying the MIG-050 rows;</li>
 *   <li>the inbound demux frame is
 *       {@code {event: <frozen channel name>, data: <bare publish payload>}}
 *       with no {@code timestamp} (§4.6 bounded clarification; envelope
 *       outbound-only);</li>
 *   <li>the room-subscription acks emitted by the real handler match the
 *       frozen ack-channel payload shapes.</li>
 * </ol>
 *
 * <p>Payload-level DTO↔generated-type conformance stays in MIG-041; this
 * test asserts the transport frame conventions MIG-050 owns.</p>
 */
@Tag("contract")
class RealtimeTransportContractAlignmentTest {

    /** The frozen 23-name canonical set (contract-canonicalization.md §4.2). */
    private static final List<String> FROZEN_23 = List.of(
            "conversation.updated", "conversation.reopened",
            "message.received", "message.sent", "message.failed",
            "notification.received", "notification.deleted", "notification.read",
            "notification.dismissed",
            "presence.updated", "typing.started", "typing.stopped",
            "user.online", "user.offline",
            "system.connection.established", "system.reconnection.started",
            "system.reconnection.failed", "system.heartbeat", "system.error",
            "system.backlog.replay.started", "system.backlog.replay.completed",
            "message.retry.scheduled", "queue.message.dlq");

    /** Frozen ack channel names (ledger WS-RAW-002/003/010/011). */
    private static final List<String> ACK_CHANNELS = List.of(
            "conversation.subscribed", "conversation.unsubscribed",
            "connector.subscribed", "connector.unsubscribed");

    /** Frozen inbound channel names (ledger WS-OP-CONV-004/005, WS-OP-CONN-003/004). */
    private static final List<String> INBOUND_CHANNELS = List.of(
            "subscribe.conversation", "unsubscribe.conversation",
            "connector.subscribe", "connector.unsubscribe");

    /** MIG-050-owned ledger row IDs (scope ceiling: the transport core). */
    private static final List<String> MIG_050_LEDGER_ROWS = List.of(
            "WS-BHV-001", "WS-OP-CONV-004", "WS-OP-CONV-005",
            "WS-OP-CONN-003", "WS-OP-CONN-004",
            "WS-RAW-002", "WS-RAW-003", "WS-RAW-010", "WS-RAW-011");

    private ObjectMapper mapper;

    private Map<String, Object> asyncapi;

    @BeforeEach
    void setUp() throws Exception {
        mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        try (Reader reader = Files.newBufferedReader(contractFile("asyncapi.yaml"))) {
            asyncapi = unchecked(() -> new Yaml().load(reader));
        }
    }

    // --- (a) outbound envelope, verbatim ---

    @Test
    void outboundEnvelopeMatchesTheFrozenEnvelopeSchema() throws Exception {
        JsonNode schema = mapper.readTree(
                contractFile("schemas/envelope.schema.json").toFile());

        assertThat(stringsOf(schema.get("required")))
                .containsExactlyInAnyOrder("event", "data", "timestamp");
        assertThat(fieldNamesOf(schema.get("properties")))
                .containsExactlyInAnyOrder("event", "data", "timestamp");

        WebSocketEnvelope envelope = WebSocketEnvelope.of(
                RealtimeEvents.MESSAGE_SENT, TextNode.valueOf("payload"));
        JsonNode wire = mapper.readTree(mapper.writeValueAsString(envelope));

        assertThat(fieldNamesOf(wire))
                .containsExactlyInAnyOrder("event", "data", "timestamp");
        assertThat(wire.get("event").asText()).isEqualTo(RealtimeEvents.MESSAGE_SENT);
        assertThat(wire.get("data").asText()).isEqualTo("payload");
        assertThat(Instant.parse(wire.get("timestamp").asText())).isNotNull();
    }

    // --- (b) the 23 event constants equal the frozen set ---

    @Test
    void eventConstantsEqualTheFrozenCanonicalSetAndEveryNameIsAContractChannel() {
        List<String> declared = declaredConstants();

        assertThat(declared).containsExactlyInAnyOrderElementsOf(concat(
                FROZEN_23, ACK_CHANNELS, INBOUND_CHANNELS));

        assertThat(channelsOf(asyncapi).keySet()).containsAll(declared);
    }

    @Test
    void theReconciledLedgerCarriesTheMig050TransportRows() {
        String ledger = unchecked(() -> Files.readString(
                contractFile("ledger-mig-003-reconciled.md")));

        assertThat(MIG_050_LEDGER_ROWS).allSatisfy(row ->
                assertThat(ledger).contains("| " + row + " "));
    }

    // --- (c) inbound demux convention ---

    @Test
    void inboundDemuxFrameCarriesTheFrozenEventNameAndBarePayloadOnly()
            throws Exception {
        WebSocketInboundFrame frame = new WebSocketInboundFrame(
                RealtimeEvents.SUBSCRIBE_CONVERSATION, TextNode.valueOf("conv-1"));
        JsonNode wire = mapper.readTree(mapper.writeValueAsString(frame));

        assertThat(fieldNamesOf(wire)).containsExactlyInAnyOrder("event", "data");
        assertThat(wire.get("event").asText()).isEqualTo("subscribe.conversation");
        assertThat(wire.get("data").asText()).isEqualTo("conv-1");

        WebSocketInboundFrame parsed = mapper.readValue(
                "{\"event\":\"connector.subscribe\",\"data\":{\"platform\":\"telegram\"}}",
                WebSocketInboundFrame.class);
        assertThat(parsed.event()).isEqualTo("connector.subscribe");
        assertThat(parsed.data().get("platform").asText()).isEqualTo("telegram");

        // `data` is the channel's frozen bare publish payload.
        Map<String, Object> conversationPayload = publishPayload("subscribe.conversation");
        assertThat(conversationPayload.get("type")).isEqualTo("string");
        Map<String, Object> connectorPayload = publishPayload("connector.subscribe");
        assertThat(yamlStrings(connectorPayload.get("required")))
                .containsExactly("platform");
        assertThat(platformEnum(connectorPayload)).containsExactly("telegram", "irc");
    }

    // --- (d) room acks match the frozen ack-channel payload shapes ---

    @Test
    void roomAcksEmittedByTheHandlerMatchTheFrozenChannelPayloadShapes()
            throws Exception {
        WebSocketSessionRegistry registry = new WebSocketSessionRegistry();
        YaccWebSocketHandler handler = new YaccWebSocketHandler(registry,
                new WebSocketEventPublisher(registry, mapper), mapper);

        Map<String, Object> attributes = new HashMap<>();
        attributes.put(WebSocketHandshakeAuthInterceptor.IDENTITY_ATTRIBUTE,
                new RealtimeSession(null, "user-1", "user-1@fixture.yacc.local",
                        "user", "Fixture user-1"));
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("s1");
        when(session.getAttributes()).thenReturn(attributes);
        List<TextMessage> sent = new CopyOnWriteArrayList<>();
        doAnswer(invocation -> {
            sent.add(invocation.getArgument(0));
            return null;
        }).when(session).sendMessage(any(TextMessage.class));

        handler.afterConnectionEstablished(session);

        sent.clear();
        handler.handleTextMessage(session, new TextMessage(
                "{\"event\":\"subscribe.conversation\",\"data\":\"conv-1\"}"));
        assertAckMatchesContract(soleFrame(sent), "conversation.subscribed",
                "conversationId");
        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-1")))
                .hasSize(1);

        sent.clear();
        handler.handleTextMessage(session, new TextMessage(
                "{\"event\":\"unsubscribe.conversation\",\"data\":\"conv-1\"}"));
        assertAckMatchesContract(soleFrame(sent), "conversation.unsubscribed",
                "conversationId");
        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-1")))
                .isEmpty();

        sent.clear();
        handler.handleTextMessage(session, new TextMessage(
                "{\"event\":\"connector.subscribe\",\"data\":{\"platform\":\"telegram\"}}"));
        assertAckMatchesContract(soleFrame(sent), "connector.subscribed",
                "platform", "timestamp");
        assertThat(registry.channelsInRoom(RealtimeRooms.connector("telegram")))
                .hasSize(1);

        sent.clear();
        handler.handleTextMessage(session, new TextMessage(
                "{\"event\":\"connector.unsubscribe\",\"data\":{\"platform\":\"telegram\"}}"));
        assertAckMatchesContract(soleFrame(sent), "connector.unsubscribed",
                "platform", "timestamp");
        assertThat(registry.channelsInRoom(RealtimeRooms.connector("telegram")))
                .isEmpty();
    }

    /** Asserts one enveloped ack frame whose bare {@code data} payload matches
     * the frozen ack-channel schema (declared properties exactly, required
     * satisfied, timestamps parseable). */
    private void assertAckMatchesContract(JsonNode envelope, String ackChannel,
            String... dataFields) throws Exception {
        assertThat(envelope.get("event").asText()).isEqualTo(ackChannel);
        assertThat(fieldNamesOf(envelope))
                .containsExactlyInAnyOrder("event", "data", "timestamp");

        Map<String, Object> payload = ackPayload(ackChannel);
        assertThat(fieldNamesOf(envelope.get("data"))).containsExactly(dataFields);
        assertThat(yamlStrings(payload.get("required"))).containsExactly(dataFields);
        assertThat(ackProperties(ackChannel).keySet())
                .containsExactlyInAnyOrderElementsOf(
                        yamlStrings(payload.get("required")));
        if (envelope.get("data").has("timestamp")) {
            assertThat(Instant.parse(envelope.get("data").get("timestamp").asText()))
                    .isNotNull();
        }
    }

    private static JsonNode soleFrame(List<TextMessage> sent) throws Exception {
        assertThat(sent).hasSize(1);
        return unchecked(() -> new ObjectMapper()
                .readTree(sent.get(0).getPayload()));
    }

    // --- contract-file helpers ---

    /** Locates a frozen contract file from the repo root (the test CWD is the
     * Gradle project dir; the walk keeps the lookup CWD-independent). */
    private static Path contractFile(String relative) {
        for (Path dir = Paths.get("").toAbsolutePath(); dir != null;
                dir = dir.getParent()) {
            Path candidate = dir.resolve(".docs").resolve("migration").resolve(relative);
            if (Files.exists(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException(
                "Frozen contract file not found: .docs/migration/" + relative);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        assertThat(value).as("expected a YAML mapping").isInstanceOf(Map.class);
        return (Map<String, Object>) value;
    }

    private static Map<String, Object> channelsOf(Map<String, Object> document) {
        return map(document.get("channels"));
    }

    private Map<String, Object> publishPayload(String channel) {
        Map<String, Object> operation = map(channelsOf(asyncapi).get(channel));
        return map(map(map(operation.get("publish")).get("message")).get("payload"));
    }

    private Map<String, Object> ackPayload(String channel) {
        Map<String, Object> operation = map(channelsOf(asyncapi).get(channel));
        return map(map(map(operation.get("subscribe")).get("message")).get("payload"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> ackProperties(String channel) {
        return map(ackPayload(channel).get("properties"));
    }

    @SuppressWarnings("unchecked")
    private static List<String> platformEnum(Map<String, Object> payload) {
        Map<String, Object> properties = map(payload.get("properties"));
        return (List<String>) map(properties.get("platform")).get("enum");
    }

    @SuppressWarnings("unchecked")
    private static List<String> yamlStrings(Object value) {
        assertThat(value).as("expected a YAML list").isInstanceOf(List.class);
        return (List<String>) value;
    }

    private static List<String> fieldNamesOf(JsonNode node) {
        List<String> names = new ArrayList<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static List<String> stringsOf(JsonNode arrayNode) {
        List<String> values = new ArrayList<>();
        arrayNode.forEach(value -> values.add(value.asText()));
        return values;
    }

    private static List<String> declaredConstants() {
        return Arrays.stream(RealtimeEvents.class.getDeclaredFields())
                .filter(field -> Modifier.isStatic(field.getModifiers())
                        && field.getType() == String.class)
                .map(RealtimeTransportContractAlignmentTest::constantOf)
                .toList();
    }

    private static String constantOf(Field field) {
        return unchecked(() -> (String) field.get(null));
    }

    @SafeVarargs
    private static List<String> concat(List<String>... lists) {
        return Arrays.stream(lists).flatMap(List::stream).toList();
    }

    private static <T> T unchecked(ThrowingSupplier<T> supplier) {
        try {
            return supplier.get();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }
}
