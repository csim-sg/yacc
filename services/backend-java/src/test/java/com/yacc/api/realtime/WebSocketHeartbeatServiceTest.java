package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * Unit tests for the application-level heartbeat (MIG-051; WS-EVT-017,
 * WS-BHV-010): every beat broadcasts exactly one enveloped
 * {@code system.heartbeat} frame with the frozen {@code heartbeat} system
 * payload type.
 */
class WebSocketHeartbeatServiceTest {

    private WebSocketEventPublisher publisher;
    private WebSocketHeartbeatService service;
    private final List<WebSocketEnvelope> emitted = new CopyOnWriteArrayList<>();

    @BeforeEach
    void setUp() {
        publisher = mock(WebSocketEventPublisher.class);
        ObjectMapper mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        doAnswer(invocation -> {
            emitted.add(invocation.getArgument(0));
            return null;
        }).when(publisher).publishToAll(any(WebSocketEnvelope.class));
        service = new WebSocketHeartbeatService(publisher, mapper);
    }

    @Test
    void beatBroadcastsTheFrozenHeartbeatSystemEvent() {
        service.beat();

        verify(publisher).publishToAll(any(WebSocketEnvelope.class));
        assertThat(emitted).hasSize(1);
        WebSocketEnvelope envelope = emitted.get(0);
        assertThat(envelope.event()).isEqualTo(RealtimeEvents.SYSTEM_HEARTBEAT);
        assertThat(envelope.data().get("type").asText())
                .isEqualTo(SystemEventPayload.TYPE_HEARTBEAT);
        assertThat(envelope.data().get("timestamp").asText()).isNotEmpty();
    }

    @Test
    void theDefaultIntervalIsTheFrozen60Seconds() {
        assertThat(WebSocketHeartbeatService.DEFAULT_INTERVAL_MS).isEqualTo("60000");
    }
}
