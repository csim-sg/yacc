package com.yacc.api.queue;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * MIG-063 frozen retry policy (AC-MIG-063-2): the backoff ladder and the
 * attempts bound are BASELINE PARITY VALUES (POC
 * {@code message-queue.types.ts RETRY_CONFIG}: 1m &rarr; 5m &rarr; 30m over
 * 3 attempts), not tunables — the defaults are pinned here and the ladder
 * computation the scheduler uses is pinned per attempt.
 */
class QueueRetryPropertiesTest {

    @Test
    void defaultsAreTheFrozenBaselineLadder() {
        QueueRetryProperties properties = new QueueRetryProperties(null, null, null);

        assertThat(properties.backoffDelaysMs()).containsExactly(60_000L, 300_000L, 1_800_000L);
        assertThat(properties.maxAttempts()).isEqualTo(3);
        assertThat(properties.markerPollIntervalMs()).isEqualTo(30_000L);
    }

    @Test
    void delayBeforeAttemptWalksTheOneFiveThirtyLadder() {
        QueueRetryProperties properties = new QueueRetryProperties(null, null, null);

        assertThat(properties.delayBeforeAttempt(1)).isEqualTo(60_000L);
        assertThat(properties.delayBeforeAttempt(2)).isEqualTo(300_000L);
        assertThat(properties.delayBeforeAttempt(3)).isEqualTo(1_800_000L);
    }

    @Test
    void beyondTheLadderTheLastDelayRepeats() {
        QueueRetryProperties properties = new QueueRetryProperties(
                List.of(10L, 20L), 5, 1_000L);

        assertThat(properties.delayBeforeAttempt(1)).isEqualTo(10L);
        assertThat(properties.delayBeforeAttempt(2)).isEqualTo(20L);
        assertThat(properties.delayBeforeAttempt(3)).isEqualTo(20L);
        assertThat(properties.delayBeforeAttempt(4)).isEqualTo(20L);
    }

    @Test
    void invalidValuesFallBackToTheFrozenDefaults() {
        QueueRetryProperties properties = new QueueRetryProperties(List.of(), 0, 0L);

        assertThat(properties.backoffDelaysMs()).containsExactly(60_000L, 300_000L, 1_800_000L);
        assertThat(properties.maxAttempts()).isEqualTo(3);
        assertThat(properties.markerPollIntervalMs()).isEqualTo(30_000L);
    }
}
