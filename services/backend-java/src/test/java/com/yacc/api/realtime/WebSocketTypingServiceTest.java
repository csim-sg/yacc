package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * Unit tests for the raw-WS typing behavior (MIG-051; WS-EVT-010/011,
 * WS-OP-TYPE-001..004, WS-BHV-015): room fan-out with the sender excluded
 * on {@code typing.started}/{@code typing.stopped}, the timeout path emitting
 * {@code typing.stopped}, the fail-closed bad-frame path, and the no-reply
 * keep-alive.
 */
class WebSocketTypingServiceTest {

    private static final String CONVERSATION = "00000000-0000-0000-0000-00000000c099";

    private WebSocketEventPublisher publisher;
    private WebSocketTypingService service;
    private ObjectMapper mapper;

    private WebSocketSession session;
    private final List<WebSocketEnvelope> emitted = new CopyOnWriteArrayList<>();

    @BeforeEach
    void setUp() {
        publisher = mock(WebSocketEventPublisher.class);
        mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        service = new WebSocketTypingService(publisher, mapper);

        session = mock(WebSocketSession.class);
        org.mockito.Mockito.when(session.getId()).thenReturn("s1");
        doAnswer(invocation -> {
            emitted.add(invocation.getArgument(1));
            return true;
        }).when(publisher).publishToSession(any(WebSocketSession.class),
                any(WebSocketEnvelope.class));
        doAnswer(invocation -> {
            emitted.add(invocation.getArgument(2));
            return null;
        }).when(publisher).publishToRoom(ArgumentMatchers.anyString(),
                ArgumentMatchers.anyString(), any(WebSocketEnvelope.class));
    }

    @Test
    void typingStartedFansOutToTheConversationRoomExceptSender() {
        service.onTypingStarted(session, mapper.createObjectNode()
                .put("conversationId", CONVERSATION)
                .put("userId", "user-1")
                .put("name", "Fixture user-1"));

        verify(publisher).publishToRoom(org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(CONVERSATION)), org.mockito.ArgumentMatchers.eq("s1"),
                any(WebSocketEnvelope.class));
        assertThat(emitted(0).event()).isEqualTo("typing.started");
        JsonNode data = emitted(0).data();
        assertThat(data.get("conversationId").asText()).isEqualTo(CONVERSATION);
        assertThat(data.get("userId").asText()).isEqualTo("user-1");
        assertThat(data.get("name").asText()).isEqualTo("Fixture user-1");
    }

    @Test
    void typingStoppedFansOutToTheConversationRoomExceptSender() {
        service.onTypingStopped(session, mapper.createObjectNode()
                .put("conversationId", CONVERSATION)
                .put("userId", "user-1"));

        verify(publisher).publishToRoom(org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(CONVERSATION)), org.mockito.ArgumentMatchers.eq("s1"),
                any(WebSocketEnvelope.class));
        assertThat(emitted(0).event()).isEqualTo("typing.stopped");
        assertThat(emitted(0).data().fieldNames()).toIterable()
                .containsExactly("conversationId", "userId");
    }

    @Test
    void typingTimeoutEmitsStoppedToTheRoom() {
        service.onTypingTimeout(session, mapper.createObjectNode()
                .put("conversationId", CONVERSATION)
                .put("userId", "user-1"));

        verify(publisher).publishToRoom(org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(CONVERSATION)), org.mockito.ArgumentMatchers.eq("s1"),
                any(WebSocketEnvelope.class));
        assertThat(emitted(0).event()).isEqualTo("typing.stopped");
    }

    @Test
    void typingStartedWithMissingMembersIsRefusedAsABadFrame() {
        service.onTypingStarted(session, mapper.createObjectNode()
                .put("conversationId", CONVERSATION));

        verify(publisher).publishToSession(eq(session), any(WebSocketEnvelope.class));
        assertThat(emitted(0).event()).isEqualTo("system.error");
        assertThat(emitted(0).data().get("error").get("code").asText())
                .isEqualTo(YaccWebSocketHandler.ERROR_CODE_BAD_FRAME);
    }

    @Test
    void typingHeartbeatIsANoReplyKeepAlive() {
        service.onTypingHeartbeat(mapper.createObjectNode()
                .put("conversationId", CONVERSATION)
                .put("userId", "user-1"));

        assertThat(emitted).isEmpty();
        verify(publisher, org.mockito.Mockito.never())
                .publishToRoom(ArgumentMatchers.anyString(), ArgumentMatchers.anyString(),
                        any(WebSocketEnvelope.class));
        verify(publisher, org.mockito.Mockito.never())
                .publishToSession(any(WebSocketSession.class), any(WebSocketEnvelope.class));
    }

    private WebSocketEnvelope emitted(int index) {
        return emitted.get(index);
    }
}
