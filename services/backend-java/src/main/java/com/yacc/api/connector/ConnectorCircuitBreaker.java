package com.yacc.api.connector;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Platform circuit breaker over the connector error stream (MIG-063;
 * ADR-028). POC {@code gateway-exchange} parity: consecutive adapter
 * failures are counted per platform, a platform whose failure count reaches
 * the frozen threshold is OPEN (the POC disconnected the adapter at this
 * point), and any recorded success resets the counter and closes the
 * breaker.
 *
 * <p>State is in-memory by design (POC {@code consecutiveFailures} parity;
 * single-instance posture, ADR-024) and consumed platform-generically: the
 * {@link ConnectorErrorHook} implementation records failures, and the
 * MIG-062 (#359) gateway exchange consults {@link #isOpen(String)} before
 * dispatch and records {@link #recordSuccess(String)} on delivered sends —
 * exactly the POC's reset-on-success point. The threshold is a parity
 * requirement, not a tunable.</p>
 */
@Component
public class ConnectorCircuitBreaker {

    private static final Logger log = LoggerFactory.getLogger(ConnectorCircuitBreaker.class);

    /**
     * Frozen threshold (POC {@code CIRCUIT_BREAKER_THRESHOLD = 5}) — five
     * consecutive adapter failures open the platform's breaker.
     */
    static final int THRESHOLD = 5;

    private final Map<String, Integer> consecutiveFailures = new ConcurrentHashMap<>();

    /**
     * Records one adapter failure on a platform (the hook calls this for
     * every surfaced adapter error).
     *
     * @return {@code true} when the failure reaches the frozen threshold and
     *         the breaker transitions to open (POC trip parity — the POC
     *         logged and disconnected the adapter here)
     */
    public boolean recordFailure(String platform) {
        int count = consecutiveFailures.merge(platform, 1, Integer::sum);
        if (count >= THRESHOLD) {
            log.error("Circuit breaker triggered - platform {} reached {} consecutive failures"
                    + " (threshold {})", platform, count, THRESHOLD);
            return true;
        }
        return false;
    }

    /**
     * Records a successful platform delivery — resets the consecutive-failure
     * count and closes the breaker (POC reset-on-success parity).
     */
    public void recordSuccess(String platform) {
        consecutiveFailures.put(platform, 0);
    }

    /** True when the platform's breaker is open (at or beyond threshold). */
    public boolean isOpen(String platform) {
        return failureCount(platform) >= THRESHOLD;
    }

    /** Current consecutive-failure count (observability input). */
    public int failureCount(String platform) {
        return consecutiveFailures.getOrDefault(platform, 0);
    }
}
