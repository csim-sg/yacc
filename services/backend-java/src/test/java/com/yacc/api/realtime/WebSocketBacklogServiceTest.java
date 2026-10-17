package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.yacc.entity.WebSocketBacklogEntry;
import com.yacc.repository.WebSocketBacklogRepository;

/**
 * Unit tests for the PostgreSQL event-backlog service (MIG-051; WS-BHV-009):
 * the baseline {@code WebSocketEventMap} eligibility set, the 1h expiry at
 * store time, the conversation-scope recording, the best-effort store
 * contract, and the sweep/clear/replay delegations.
 */
class WebSocketBacklogServiceTest {

    private WebSocketBacklogRepository repository;
    private WebSocketBacklogService service;
    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        repository = mock(WebSocketBacklogRepository.class);
        service = new WebSocketBacklogService(repository);
        mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
    }

    private WebSocketEnvelope envelope(String event) {
        return WebSocketEnvelope.of(event, mapper.createObjectNode().put("id", "m-1"));
    }

    @Test
    void eligibleEventsAreExactlyTheBaselineGatewayFamilies() {
        assertThat(service.isEligible("message.received")).isTrue();
        assertThat(service.isEligible("message.sent")).isTrue();
        assertThat(service.isEligible("message.failed")).isTrue();
        assertThat(service.isEligible("conversation.updated")).isTrue();
        assertThat(service.isEligible("conversation.reopened")).isTrue();
        assertThat(service.isEligible("notification.received")).isTrue();
        assertThat(service.isEligible("notification.read")).isTrue();
        assertThat(service.isEligible("notification.dismissed")).isTrue();
        assertThat(service.isEligible("message.retry.scheduled")).isTrue();
        assertThat(service.isEligible("queue.message.dlq")).isTrue();
        // never stored by the baseline gateway emit paths:
        assertThat(service.isEligible("presence.updated")).isFalse();
        assertThat(service.isEligible("typing.started")).isFalse();
        assertThat(service.isEligible("system.heartbeat")).isFalse();
        assertThat(service.isEligible("system.backlog.replay.started")).isFalse();
        assertThat(service.isEligible("conversation.subscribed")).isFalse();
    }

    @Test
    void storeWritesOneRowWithOneHourExpiryAndConversationScope() {
        LocalDateTime before = LocalDateTime.now();

        service.store("user-1", RealtimeRooms.conversation(
                        "00000000-0000-0000-0000-00000000c099"),
                envelope("message.received"));

        ArgumentCaptor<WebSocketBacklogEntry> captor =
                ArgumentCaptor.forClass(WebSocketBacklogEntry.class);
        verify(repository).save(captor.capture());
        WebSocketBacklogEntry row = captor.getValue();
        assertThat(row.getUserId()).isEqualTo("user-1");
        assertThat(row.getEventName()).isEqualTo("message.received");
        assertThat(row.getConversationId())
                .isEqualTo(UUID.fromString("00000000-0000-0000-0000-00000000c099"));
        assertThat(row.getPayload()).contains("\"m-1\"");
        assertThat(row.getEmittedAt()).isAfterOrEqualTo(before);
        assertThat(row.getExpiresAt()).isAfterOrEqualTo(before.plus(WebSocketBacklogService.BACKLOG_WINDOW));
        assertThat(row.getExpiresAt()).isBefore(row.getEmittedAt()
                .plus(WebSocketBacklogService.BACKLOG_WINDOW).plusSeconds(5));
    }

    @Test
    void storeWithoutConversationRoomRecordsNoScope() {
        service.store("user-1", null, envelope("queue.message.dlq"));

        ArgumentCaptor<WebSocketBacklogEntry> captor =
                ArgumentCaptor.forClass(WebSocketBacklogEntry.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getConversationId()).isNull();
    }

    @Test
    void storeIsBestEffortAndNeverThrows() {
        doThrow(new IllegalStateException("db gone")).when(repository).save(any());

        assertThatCode(() -> service.store("user-1", null, envelope("message.sent")))
                .doesNotThrowAnyException();
    }

    @Test
    void ineligibleEventsNeverTouchTheRepository() {
        service.store("user-1", null, envelope("presence.updated"));

        verify(repository, never()).save(any());
    }

    @Test
    void replayRowsReadsUnexpiredRowsOrderedByEmission() {
        WebSocketBacklogEntry row = new WebSocketBacklogEntry("user-1", "message.received",
                null, "{}", LocalDateTime.now(), LocalDateTime.now().plusHours(1));
        when(repository.findByUserIdAndExpiresAtAfterOrderByEmittedAtAsc(
                org.mockito.ArgumentMatchers.eq("user-1"), any(LocalDateTime.class)))
                .thenReturn(List.of(row));

        assertThat(service.replayRows("user-1")).containsExactly(row);
    }

    @Test
    void clearDeletesExactlyTheGivenRowsAndSweepDelegatesToTheRepository() {
        service.clear("user-1", java.util.List.of(row(7L), row(9L)));
        service.purgeExpired();

        verify(repository).deleteByUserIdAndIdIn(org.mockito.ArgumentMatchers.eq("user-1"),
                org.mockito.ArgumentMatchers.argThat(arg -> {
                    @SuppressWarnings("unchecked")
                    java.util.Collection<Long> deliveredIds = (java.util.Collection<Long>) arg;
                    return deliveredIds.size() == 2 && deliveredIds.contains(7L)
                            && deliveredIds.contains(9L);
                }));
        verify(repository, never()).deleteByUserId(any());
        verify(repository).deleteByExpiresAtBefore(any(LocalDateTime.class));
    }

    @Test
    void clearWithoutDeliveredRowsTouchesNothing() {
        service.clear("user-1", List.of());

        verify(repository, never()).deleteByUserIdAndIdIn(any(), any());
    }

    /** Id-stubbed backlog row (the entity's id is JPA-assigned). */
    private static WebSocketBacklogEntry row(long id) {
        WebSocketBacklogEntry row = org.mockito.Mockito.mock(WebSocketBacklogEntry.class);
        org.mockito.Mockito.when(row.getId()).thenReturn(id);
        return row;
    }
}
