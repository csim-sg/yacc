package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Unit tests for the typed reconnect policy (MIG-051; ledger WS-BHV-011 —
 * the frozen {@code RECONNECT_CONFIG}: initial 1000ms, max 60000ms,
 * maxAttempts 5, factor 2) and its deterministic exponential-backoff
 * computation. The client backoff ladder itself is MIG-052's
 * (canonicalization §3).
 */
class RealtimePropertiesTest {

    @Test
    void reconnectDefaultsAreTheFrozenPolicyValues() {
        RealtimeProperties properties = new RealtimeProperties(null, null);

        assertThat(properties.websocket().path()).isEqualTo(RealtimeProperties.WebSocket.DEFAULT_PATH);
        assertThat(properties.reconnect().initialDelayMs()).isEqualTo(1000);
        assertThat(properties.reconnect().maxDelayMs()).isEqualTo(60000);
        assertThat(properties.reconnect().maxAttempts()).isEqualTo(5);
        assertThat(properties.reconnect().backoffFactor()).isEqualTo(2);
    }

    @Test
    void backoffComputationIsDeterministicExponentialGrowthCappedAtMax() {
        RealtimeProperties.Reconnect reconnect = new RealtimeProperties.Reconnect(
                null, null, null, null);

        assertThat(reconnect.delayForAttempt(1)).isEqualTo(1000);
        assertThat(reconnect.delayForAttempt(2)).isEqualTo(2000);
        assertThat(reconnect.delayForAttempt(3)).isEqualTo(4000);
        assertThat(reconnect.delayForAttempt(4)).isEqualTo(8000);
        assertThat(reconnect.delayForAttempt(5)).isEqualTo(16000);
        assertThat(reconnect.delayForAttempt(6)).isEqualTo(32000);
        assertThat(reconnect.delayForAttempt(7)).isEqualTo(60000);
        assertThat(reconnect.delayForAttempt(50)).isEqualTo(60000);
    }

    @Test
    void customPolicyComputesItsOwnLadder() {
        RealtimeProperties.Reconnect reconnect = new RealtimeProperties.Reconnect(
                500, 2000, 3, 3);

        assertThat(reconnect.delayForAttempt(1)).isEqualTo(500);
        assertThat(reconnect.delayForAttempt(2)).isEqualTo(1500);
        assertThat(reconnect.delayForAttempt(3)).isEqualTo(2000);
    }

    @Test
    void policyIsExhaustedAfterMaxAttempts() {
        RealtimeProperties.Reconnect reconnect = new RealtimeProperties.Reconnect(
                null, null, null, null);

        assertThat(reconnect.exhausted(5)).isFalse();
        assertThat(reconnect.exhausted(6)).isTrue();
    }

    @Test
    void invalidValuesFallBackToTheFrozenPolicy() {
        RealtimeProperties.Reconnect reconnect = new RealtimeProperties.Reconnect(
                -1, 0, -5, 1);

        assertThat(reconnect.initialDelayMs()).isEqualTo(1000);
        assertThat(reconnect.maxDelayMs()).isEqualTo(60000);
        assertThat(reconnect.maxAttempts()).isEqualTo(5);
        assertThat(reconnect.backoffFactor()).isEqualTo(2);
    }
}
