package com.yacc.api.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;

import org.junit.jupiter.api.Test;

/**
 * IRC connection state holder tests (MIG-061 added the connector-driven
 * transitions {@code markRetrying}/{@code markDisconnected} and the frozen
 * contract alignment in {@code markConnected}): incident-id lifecycle,
 * attempt counting, and the connected/disconnected transitions.
 */
class IrcConnectionStateTest {

    @Test
    void markRetryingMintsAStableIncidentIdPerIncident() {
        IrcConnectionState state = new IrcConnectionState();

        state.markRetrying(0);
        UUID first = state.snapshot().reconnectIncidentId();
        assertThat(first).isNotNull();

        state.markRetrying(1);
        state.markRetrying(2);
        assertThat(state.snapshot().reconnectIncidentId()).isEqualTo(first);
        assertThat(state.snapshot().status()).isEqualTo("retrying");
        assertThat(state.snapshot().attemptCount()).isEqualTo(2);
    }

    @Test
    void aNewIncidentGetsAFreshIdAfterAnAttemptZeroTransition() {
        IrcConnectionState state = new IrcConnectionState();

        state.markRetrying(0);
        UUID first = state.snapshot().reconnectIncidentId();

        state.markConnected();
        state.markRetrying(0);
        assertThat(state.snapshot().reconnectIncidentId()).isNotEqualTo(first);
    }

    @Test
    void markConnectedClearsTheIncidentAndRecordsTheConnection() {
        IrcConnectionState state = new IrcConnectionState();
        state.markRetrying(3);

        state.markConnected();

        IrcConnectionStatus snapshot = state.snapshot();
        assertThat(snapshot.status()).isEqualTo("connected");
        assertThat(snapshot.attemptCount()).isZero();
        assertThat(snapshot.lastConnectedAt()).isNotNull();
        assertThat(snapshot.lastError()).isNull();
        assertThat(snapshot.reconnectIncidentId()).isNull();
    }

    @Test
    void markFailedReportsTheAttemptCountAndError() {
        IrcConnectionState state = new IrcConnectionState();
        state.markRetrying(0);

        state.markFailed(5, "connection refused");

        IrcConnectionStatus snapshot = state.snapshot();
        assertThat(snapshot.status()).isEqualTo("failed");
        assertThat(snapshot.attemptCount()).isEqualTo(5);
        assertThat(snapshot.lastError()).isEqualTo("connection refused");
        assertThat(snapshot.reconnectIncidentId()).isNotNull();
    }

    @Test
    void markDisconnectedResetsTheAttemptCount() {
        IrcConnectionState state = new IrcConnectionState();
        state.markRetrying(2);

        state.markDisconnected();

        IrcConnectionStatus snapshot = state.snapshot();
        assertThat(snapshot.status()).isEqualTo("disconnected");
        assertThat(snapshot.attemptCount()).isZero();
    }

    @Test
    void manualRetryingKeepsThePreExistingIncidentSemantics() {
        IrcConnectionState state = new IrcConnectionState();
        state.setManualRetrying();
        UUID first = state.snapshot().reconnectIncidentId();

        state.setManualRetrying();

        assertThat(state.snapshot().reconnectIncidentId()).isEqualTo(first);
        assertThat(state.snapshot().status()).isEqualTo("retrying");
        assertThat(state.snapshot().attemptCount()).isZero();
    }
}
