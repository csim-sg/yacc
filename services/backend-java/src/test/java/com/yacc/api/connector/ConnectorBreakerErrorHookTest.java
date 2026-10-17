package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.LocalDateTime;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * MIG-063 hook wiring (AC-MIG-060-2 completion): every surfaced adapter
 * error feeds the platform circuit breaker exactly once, the hook never
 * throws (the seam contract), and repeated errors stay safe (one breaker
 * count each). DLQ entry creation requires message correlation (frozen FKs)
 * and is owned by the delivery path — {@code DlqService#enqueue}, MIG-062.
 */
@ExtendWith(MockitoExtension.class)
class ConnectorBreakerErrorHookTest {

    @Mock
    private ConnectorCircuitBreaker breaker;

    private ConnectorBreakerErrorHook hook;

    @BeforeEach
    void setUp() {
        hook = new ConnectorBreakerErrorHook(breaker);
    }

    @Test
    void routesEverySurfacedErrorToThePlatformBreaker() {
        ConnectorAdapterError error = new ConnectorAdapterError("telegram", "sendMessage",
                ConnectorErrorCode.NETWORK_ERROR, "connect timed out", true,
                LocalDateTime.of(2026, 10, 18, 8, 0));

        hook.onAdapterError(error);

        verify(breaker).recordFailure("telegram");
    }

    @Test
    void neverThrowsWhenTheBreakerFails() {
        doThrow(new IllegalStateException("breaker boom")).when(breaker).recordFailure("telegram");
        ConnectorAdapterError error = new ConnectorAdapterError("telegram", "sendMessage",
                ConnectorErrorCode.RATE_LIMIT, "429", true, LocalDateTime.now());

        assertThatCode(() -> hook.onAdapterError(error)).doesNotThrowAnyException();
    }

    @Test
    void repeatedErrorsAreSafeOneCountEach() {
        ConnectorAdapterError error = new ConnectorAdapterError("irc", "sendMessage",
                ConnectorErrorCode.RATE_LIMIT, "429", true, LocalDateTime.now());

        hook.onAdapterError(error);
        hook.onAdapterError(error);

        verify(breaker, times(2)).recordFailure("irc");
        verify(breaker, times(2)).recordFailure(anyString());
    }

    @Test
    void platformsStayIsolatedThroughTheHook() {
        hook.onAdapterError(new ConnectorAdapterError("telegram", "sendMessage",
                ConnectorErrorCode.NETWORK_ERROR, "timeout", true, LocalDateTime.now()));
        hook.onAdapterError(new ConnectorAdapterError("irc", "connect",
                ConnectorErrorCode.INVALID_CREDENTIALS, "bad nick", false, LocalDateTime.now()));

        verify(breaker).recordFailure("telegram");
        verify(breaker).recordFailure("irc");
    }
}
