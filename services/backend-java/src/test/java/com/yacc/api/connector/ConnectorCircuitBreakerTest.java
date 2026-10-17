package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * MIG-063 circuit breaker (AC-MIG-063-1/2): the frozen threshold is 5
 * consecutive failures per platform (POC
 * {@code gateway-exchange.CIRCUIT_BREAKER_THRESHOLD} parity), a success
 * resets the count (POC reset-on-success parity), and platforms are
 * isolated.
 */
class ConnectorCircuitBreakerTest {

    @Test
    void opensExactlyAtTheFrozenThresholdOfFiveConsecutiveFailures() {
        ConnectorCircuitBreaker breaker = new ConnectorCircuitBreaker();

        assertThat(breaker.recordFailure("telegram")).isFalse();
        assertThat(breaker.recordFailure("telegram")).isFalse();
        assertThat(breaker.recordFailure("telegram")).isFalse();
        assertThat(breaker.recordFailure("telegram")).isFalse();
        assertThat(breaker.isOpen("telegram")).isFalse();

        assertThat(breaker.recordFailure("telegram")).isTrue();
        assertThat(breaker.isOpen("telegram")).isTrue();
        assertThat(breaker.failureCount("telegram")).isEqualTo(5);
    }

    @Test
    void successResetsTheCountAndClosesTheBreaker() {
        ConnectorCircuitBreaker breaker = new ConnectorCircuitBreaker();

        for (int attempt = 0; attempt < 5; attempt++) {
            breaker.recordFailure("telegram");
        }
        assertThat(breaker.isOpen("telegram")).isTrue();

        breaker.recordSuccess("telegram");

        assertThat(breaker.isOpen("telegram")).isFalse();
        assertThat(breaker.failureCount("telegram")).isZero();
    }

    @Test
    void platformsAreIsolated() {
        ConnectorCircuitBreaker breaker = new ConnectorCircuitBreaker();

        for (int attempt = 0; attempt < 5; attempt++) {
            breaker.recordFailure("telegram");
        }

        assertThat(breaker.isOpen("irc")).isFalse();
        assertThat(breaker.failureCount("irc")).isZero();
    }
}
