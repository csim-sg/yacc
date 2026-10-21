package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Unit tests for the MIG-091a inbound application-operation relay (ledger
 * WS-OP-CONV-003, WS-OP-MSG-001..004, WS-OP-REACT-001..004; raw emissions
 * WS-RAW-004/005/014/015/016): the frozen payload shapes, the emission
 * targets (room fan-out except the sender / sender-directed acks) and the
 * NO-BACKLOG fan-out guarantee (G3 — the baseline
 * {@code socket.to(room).emit} emits were never stored for replay, so the
 * backlog-eligible {@code message.sent}/{@code message.failed}/
 * {@code conversation.updated} must not gain replay entries here).
 */
class ApplicationEventRelayServiceTest {

    private static final String SENDER_SESSION = "s1";

    private static final String CONVERSATION_ID =
            "00000000-0000-4000-8000-0000000000c1";

    private WebSocketEventPublisher publisher;

    private ApplicationEventRelayService relay;

    private ObjectMapper mapper;

    private WebSocketSession sender;

    @BeforeEach
    void setUp() {
        publisher = mock(WebSocketEventPublisher.class);
        mapper = com.fasterxml.jackson.databind.json.JsonMapper.builder()
                .addModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
                .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        relay = new ApplicationEventRelayService(publisher, mapper);
        sender = mock(WebSocketSession.class);
        when(sender.getId()).thenReturn(SENDER_SESSION);
    }

    // --- pass-through room fan-outs (verbatim payload, sender excluded) ---

    @Test
    void conversationUpdatedFansOutTheVerbatimPayloadWithoutAck() {
        ObjectNode payload = conversationUpdatedPayload();

        relay.relayConversationUpdated(sender, payload);

        ArgumentCaptor<WebSocketEnvelope> captor = envelopeCaptor();
        verify(publisher).fanOutToRoom(
                org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(CONVERSATION_ID)),
                org.mockito.ArgumentMatchers.eq(SENDER_SESSION), captor.capture());
        assertThat(captor.getValue().event()).isEqualTo(RealtimeEvents.CONVERSATION_UPDATED);
        assertThat(captor.getValue().data()).isEqualTo(payload);
        verify(publisher, never()).publishToSession(any(), any());
    }

    @Test
    void messageSentFansOutTheVerbatimPayload() {
        ObjectNode payload = messageSentPayload();

        relay.relayMessageSent(sender, payload);

        ArgumentCaptor<WebSocketEnvelope> captor = envelopeCaptor();
        verify(publisher).fanOutToRoom(
                org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(CONVERSATION_ID)),
                org.mockito.ArgumentMatchers.eq(SENDER_SESSION), captor.capture());
        assertThat(captor.getValue().event()).isEqualTo(RealtimeEvents.MESSAGE_SENT);
        assertThat(captor.getValue().data()).isEqualTo(payload);
    }

    @Test
    void messageFailedFansOutTheVerbatimPayload() {
        ObjectNode payload = messageFailedPayload();

        relay.relayMessageFailed(sender, payload);

        ArgumentCaptor<WebSocketEnvelope> captor = envelopeCaptor();
        verify(publisher).fanOutToRoom(
                org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(CONVERSATION_ID)),
                org.mockito.ArgumentMatchers.eq(SENDER_SESSION), captor.capture());
        assertThat(captor.getValue().event()).isEqualTo(RealtimeEvents.MESSAGE_FAILED);
        assertThat(captor.getValue().data()).isEqualTo(payload);
    }

    // --- retry (relay-exact: ack + broadcast only; G2) ---

    @Test
    void messageRetryAcksTheSenderThenBroadcastsStartedToTheRoom() {
        ObjectNode payload = retryPayload();

        relay.relayMessageRetry(sender, payload);

        ArgumentCaptor<WebSocketEnvelope> ack = envelopeCaptor();
        verify(publisher).publishToSession(
                org.mockito.ArgumentMatchers.eq(sender), ack.capture());
        assertThat(ack.getValue().event())
                .isEqualTo(RealtimeEvents.MESSAGE_RETRY_ACKNOWLEDGED);
        assertThat(ack.getValue().data().fieldNames())
                .toIterable().containsExactly("messageId", "timestamp");
        assertThat(ack.getValue().data().path("messageId").asText()).isEqualTo("m-1");

        ArgumentCaptor<WebSocketEnvelope> started = envelopeCaptor();
        verify(publisher).fanOutToRoom(
                org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(CONVERSATION_ID)),
                org.mockito.ArgumentMatchers.eq(SENDER_SESSION), started.capture());
        assertThat(started.getValue().event()).isEqualTo(RealtimeEvents.MESSAGE_RETRY_STARTED);
        assertThat(started.getValue().data().fieldNames())
                .toIterable().containsExactly("messageId", "conversationId", "timestamp");

        // Baseline order: the ack precedes the room broadcast.
        InOrder inOrder = inOrder(publisher);
        inOrder.verify(publisher).publishToSession(any(), any());
        inOrder.verify(publisher).fanOutToRoom(anyString(), anyString(), any());
    }

    // --- received ack (silent, non-replying; WS-OP-MSG-004) ---

    @Test
    void messageReceivedAckEmitsNothingAtAll() {
        relay.relayMessageReceivedAck(retryPayload());
        relay.relayMessageReceivedAck(null);
        relay.relayMessageReceivedAck(mapper.createObjectNode());

        verifyNoPublisherInteractions();
    }

    // --- reactions ---

    @Test
    void reactionAddedFansOutTheVerbatimPayloadThenAcksTheSender() {
        ObjectNode payload = reactionAddedPayload();

        relay.relayReactionAdded(sender, payload);

        ArgumentCaptor<WebSocketEnvelope> fanOut = envelopeCaptor();
        verify(publisher).fanOutToRoom(
                org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(CONVERSATION_ID)),
                org.mockito.ArgumentMatchers.eq(SENDER_SESSION), fanOut.capture());
        assertThat(fanOut.getValue().event()).isEqualTo(RealtimeEvents.REACTION_ADDED);
        assertThat(fanOut.getValue().data()).isEqualTo(payload);

        ArgumentCaptor<WebSocketEnvelope> ack = envelopeCaptor();
        verify(publisher).publishToSession(
                org.mockito.ArgumentMatchers.eq(sender), ack.capture());
        assertThat(ack.getValue().event()).isEqualTo(RealtimeEvents.REACTION_ADDED_ACK);
        assertThat(ack.getValue().data().fieldNames())
                .toIterable().containsExactly("messageId", "emoji", "timestamp");
        assertThat(ack.getValue().data().path("emoji").asText()).isEqualTo("👍");
    }

    @Test
    void reactionRemovedFansOutTheVerbatimPayloadThenAcksTheSender() {
        ObjectNode payload = reactionRemovedPayload();

        relay.relayReactionRemoved(sender, payload);

        ArgumentCaptor<WebSocketEnvelope> fanOut = envelopeCaptor();
        verify(publisher).fanOutToRoom(
                org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(CONVERSATION_ID)),
                org.mockito.ArgumentMatchers.eq(SENDER_SESSION), fanOut.capture());
        assertThat(fanOut.getValue().event()).isEqualTo(RealtimeEvents.REACTION_REMOVED);
        assertThat(fanOut.getValue().data()).isEqualTo(payload);

        ArgumentCaptor<WebSocketEnvelope> ack = envelopeCaptor();
        verify(publisher).publishToSession(
                org.mockito.ArgumentMatchers.eq(sender), ack.capture());
        assertThat(ack.getValue().event()).isEqualTo(RealtimeEvents.REACTION_REMOVED_ACK);
        assertThat(ack.getValue().data().fieldNames())
                .toIterable().containsExactly("messageId", "emoji", "timestamp");
    }

    @Test
    void reactionListRepliesToTheSenderWithAnEmptyReactionSet() {
        ObjectNode payload = mapper.createObjectNode().put("messageId", "m-1");

        relay.relayReactionList(sender, payload);

        ArgumentCaptor<WebSocketEnvelope> reply = envelopeCaptor();
        verify(publisher).publishToSession(
                org.mockito.ArgumentMatchers.eq(sender), reply.capture());
        assertThat(reply.getValue().event()).isEqualTo(RealtimeEvents.REACTION_LIST_ACK);
        assertThat(reply.getValue().data().fieldNames())
                .toIterable().containsExactly("messageId", "reactions", "timestamp");
        assertThat(reply.getValue().data().path("reactions").isArray()).isTrue();
        assertThat(reply.getValue().data().path("reactions").size()).isZero();
        verify(publisher, never()).fanOutToRoom(anyString(), anyString(), any());
    }

    @Test
    void reactionCountFansOutTheRegeneratedCountPayloadExceptTheSender() {
        ObjectNode payload = reactionCountPayload("2026-10-21T08:00:00.000Z");

        relay.relayReactionCount(sender, payload);

        ArgumentCaptor<WebSocketEnvelope> fanOut = envelopeCaptor();
        verify(publisher).fanOutToRoom(
                org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(CONVERSATION_ID)),
                org.mockito.ArgumentMatchers.eq(SENDER_SESSION), fanOut.capture());
        assertThat(fanOut.getValue().event()).isEqualTo(RealtimeEvents.REACTION_COUNT);
        JsonNode data = fanOut.getValue().data();
        assertThat(data.fieldNames())
                .toIterable().containsExactly("messageId", "emoji", "count", "timestamp");
        assertThat(data.path("count").asInt()).isEqualTo(3);
        // Baseline regenerates the timestamp (the inbound one is dropped).
        assertThat(data.path("timestamp").asText())
                .isNotEqualTo("2026-10-21T08:00:00.000Z")
                .matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z");
    }

    // --- validation (G4: member-naming IllegalArgumentException) ---

    @Test
    void conversationUpdatedRejectsMissingAndInvalidMembers() {
        assertThatThrownBy(() -> relay.relayConversationUpdated(sender, null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("conversationId");
        assertThatThrownBy(() -> relay.relayConversationUpdated(sender,
                mapper.createObjectNode()))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("conversationId");
        ObjectNode missingFields = conversationUpdatedPayload();
        missingFields.remove("updatedFields");
        assertThatThrownBy(() -> relay.relayConversationUpdated(sender, missingFields))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("updatedFields");
        ObjectNode nonObjectFields = conversationUpdatedPayload();
        nonObjectFields.put("updatedFields", "not-an-object");
        assertThatThrownBy(() -> relay.relayConversationUpdated(sender, nonObjectFields))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("updatedFields");
        ObjectNode missingChangedAt = conversationUpdatedPayload();
        missingChangedAt.remove("changedAt");
        assertThatThrownBy(() -> relay.relayConversationUpdated(sender, missingChangedAt))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("changedAt");
    }

    @Test
    void messageSentRejectsTheWrongStatusConstant() {
        ObjectNode wrong = messageSentPayload();
        wrong.put("status", "failed");
        assertThatThrownBy(() -> relay.relayMessageSent(sender, wrong))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("status");
    }

    @Test
    void messageFailedRejectsTheWrongStatusConstantAndOutOfRangeAttempts() {
        ObjectNode wrong = messageFailedPayload();
        wrong.put("status", "sent");
        assertThatThrownBy(() -> relay.relayMessageFailed(sender, wrong))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("status");

        ObjectNode zero = messageFailedPayload();
        zero.put("attempt", 0);
        assertThatThrownBy(() -> relay.relayMessageFailed(sender, zero))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("attempt");

        ObjectNode four = messageFailedPayload();
        four.put("attempt", 4);
        assertThatThrownBy(() -> relay.relayMessageFailed(sender, four))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("attempt");

        ObjectNode fractional = messageFailedPayload();
        fractional.put("attempt", 1.5);
        assertThatThrownBy(() -> relay.relayMessageFailed(sender, fractional))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("attempt");
    }

    @Test
    void messageRetryReactionListAndCountRejectMissingRequiredMembers() {
        assertThatThrownBy(() -> relay.relayMessageRetry(sender,
                mapper.createObjectNode().put("messageId", "m-1")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("conversationId");
        assertThatThrownBy(() -> relay.relayReactionList(sender, mapper.createObjectNode()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("messageId");

        ObjectNode missingCount = reactionCountPayload(null);
        missingCount.remove("count");
        assertThatThrownBy(() -> relay.relayReactionCount(sender, missingCount))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("count");
        ObjectNode fractionalCount = reactionCountPayload(null);
        fractionalCount.put("count", 1.5);
        assertThatThrownBy(() -> relay.relayReactionCount(sender, fractionalCount))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("count");

        ObjectNode missingName = reactionAddedPayload();
        missingName.remove("name");
        assertThatThrownBy(() -> relay.relayReactionAdded(sender, missingName))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("name");
        ObjectNode missingUser = reactionRemovedPayload();
        missingUser.remove("userId");
        assertThatThrownBy(() -> relay.relayReactionRemoved(sender, missingUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("userId");
    }

    // --- G3: the no-backlog fan-out primitive end to end ---

    @Test
    void fanOutsNeverStoreBacklogEntriesEvenForBacklogEligibleEvents() throws Exception {
        WebSocketSessionRegistry registry = new WebSocketSessionRegistry();
        WebSocketBacklogService backlog = mock(WebSocketBacklogService.class);
        when(backlog.isEligible(any())).thenAnswer(invocation ->
                WebSocketBacklogService.isBaselineEligibleEvent(
                        invocation.getArgument(0, String.class)));
        WebSocketEventPublisher realPublisher = new WebSocketEventPublisher(
                registry, backlog, mapper);
        ApplicationEventRelayService realRelay =
                new ApplicationEventRelayService(realPublisher, mapper);

        WebSocketSession senderSession = registeredSession(registry, "s1", "user-1");
        WebSocketSession peer = registeredSession(registry, "s2", "user-2");
        List<TextMessage> peerFrames = new java.util.concurrent.CopyOnWriteArrayList<>();
        org.mockito.Mockito.doAnswer(invocation -> {
            peerFrames.add(invocation.getArgument(0));
            return null;
        }).when(peer).sendMessage(any(TextMessage.class));
        registry.joinRoom("s1", RealtimeRooms.conversation(CONVERSATION_ID));
        registry.joinRoom("s2", RealtimeRooms.conversation(CONVERSATION_ID));

        // message.sent, message.failed and conversation.updated ARE
        // backlog-eligible — the fan-out primitive must not store them.
        realRelay.relayMessageSent(senderSession, messageSentPayload());
        realRelay.relayMessageFailed(senderSession, messageFailedPayload());
        realRelay.relayConversationUpdated(senderSession, conversationUpdatedPayload());
        realRelay.relayMessageRetry(senderSession, retryPayload());
        realRelay.relayReactionAdded(senderSession, reactionAddedPayload());
        realRelay.relayReactionRemoved(senderSession, reactionRemovedPayload());
        realRelay.relayReactionList(senderSession,
                mapper.createObjectNode().put("messageId", "m-1"));
        realRelay.relayReactionCount(senderSession, reactionCountPayload(null));
        realRelay.relayMessageReceivedAck(retryPayload());

        verify(backlog, never()).store(any(), any(), any());

        // The peer received the room fan-outs; the eligible events carry the
        // exact frozen wire names.
        List<String> peerEvents = peerFrames.stream()
                .map(frame -> uncheckedParse(frame).path("event").asText())
                .toList();
        assertThat(peerEvents).containsExactly(
                RealtimeEvents.MESSAGE_SENT,
                RealtimeEvents.MESSAGE_FAILED,
                RealtimeEvents.CONVERSATION_UPDATED,
                RealtimeEvents.MESSAGE_RETRY_STARTED,
                RealtimeEvents.REACTION_ADDED,
                RealtimeEvents.REACTION_REMOVED,
                RealtimeEvents.REACTION_COUNT);
    }

    // --- fixtures ---

    private ObjectNode conversationUpdatedPayload() {
        ObjectNode payload = mapper.createObjectNode()
                .put("conversationId", CONVERSATION_ID)
                .put("changedBy", "00000000-0000-4000-8000-0000000000u1")
                .put("changedAt", "2026-10-21T08:00:00.000Z");
        payload.putObject("updatedFields").put("status", "open");
        return payload;
    }

    private ObjectNode messageSentPayload() {
        return mapper.createObjectNode()
                .put("messageId", "m-1")
                .put("conversationId", CONVERSATION_ID)
                .put("status", "sent")
                .put("sentAt", "2026-10-21T08:00:01.000Z");
    }

    private ObjectNode messageFailedPayload() {
        return mapper.createObjectNode()
                .put("messageId", "m-1")
                .put("conversationId", CONVERSATION_ID)
                .put("status", "failed")
                .put("error", "NETWORK_ERROR")
                .put("retryAt", "2026-10-21T08:00:02.000Z")
                .put("attempt", 1);
    }

    private ObjectNode retryPayload() {
        return mapper.createObjectNode()
                .put("messageId", "m-1")
                .put("conversationId", CONVERSATION_ID);
    }

    private ObjectNode reactionAddedPayload() {
        return mapper.createObjectNode()
                .put("messageId", "m-1")
                .put("conversationId", CONVERSATION_ID)
                .put("emoji", "👍")
                .put("userId", "00000000-0000-4000-8000-0000000000u1")
                .put("name", "Fixture user-1");
    }

    private ObjectNode reactionRemovedPayload() {
        return mapper.createObjectNode()
                .put("messageId", "m-1")
                .put("conversationId", CONVERSATION_ID)
                .put("emoji", "👍")
                .put("userId", "00000000-0000-4000-8000-0000000000u1");
    }

    private ObjectNode reactionCountPayload(String timestamp) {
        ObjectNode payload = mapper.createObjectNode()
                .put("messageId", "m-1")
                .put("conversationId", CONVERSATION_ID)
                .put("emoji", "👍")
                .put("count", 3);
        if (timestamp != null) {
            payload.put("timestamp", timestamp);
        }
        return payload;
    }

    // --- helpers ---

    private ArgumentCaptor<WebSocketEnvelope> envelopeCaptor() {
        return ArgumentCaptor.forClass(WebSocketEnvelope.class);
    }

    private void verifyNoPublisherInteractions() {
        verify(publisher, never()).fanOutToRoom(anyString(), anyString(), any());
        verify(publisher, never()).publishToRoom(anyString(), any(WebSocketEnvelope.class));
        verify(publisher, never()).publishToRoom(anyString(), anyString(),
                any(WebSocketEnvelope.class));
        verify(publisher, never()).publishToAll(any(WebSocketEnvelope.class));
        verify(publisher, never()).publishToAll(anyString(), any(WebSocketEnvelope.class));
        verify(publisher, never()).publishToSession(any(), any());
    }

    private static WebSocketSession registeredSession(WebSocketSessionRegistry registry,
            String sessionId, String userId) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(sessionId);
        registry.register(new RealtimeSession(sessionId, userId,
                userId + "@fixture.yacc.local", "user", "Fixture " + userId), session);
        return session;
    }

    private JsonNode uncheckedParse(TextMessage frame) {
        try {
            return mapper.readTree(frame.getPayload());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
