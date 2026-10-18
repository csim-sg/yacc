package com.yacc.api.queue;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * MIG-063 DB-backed retry policy binding (ADR-028; guardrails 004 §4).
 * Colocated in the {@code queue} module; every value has a KISS default so
 * local development works with zero configuration.
 *
 * <p>The defaults are BASELINE PARITY VALUES, not tunables (POC
 * {@code message-queue.types.ts RETRY_CONFIG}): the redelivery backoff
 * ladder is 1m &rarr; 5m &rarr; 30m over max 3 attempts per retry cycle.
 * Overrides exist so the environment/tests can bound the policy
 * deterministically; production keeps the frozen defaults. The worker
 * concurrency (5) is the Quartz worker-thread pool
 * ({@code spring.quartz.properties.org.quartz.threadPool.threadCount}) and
 * the breaker threshold (5) belongs to the connector module
 * ({@code com.yacc.api.connector.ConnectorCircuitBreaker}).</p>
 *
 * @param backoffDelaysMs      delay before each redelivery attempt, in
 *                             milliseconds ({@code YACC_QUEUE_RETRY_BACKOFF_DELAYS_MS},
 *                             comma-separated)
 * @param maxAttempts          redelivery attempts per retry cycle
 *                             ({@code YACC_QUEUE_RETRY_MAX_ATTEMPTS})
 * @param markerPollIntervalMs retried-marker consumer cadence — storage
 *                             hygiene, not a contract value
 *                             ({@code YACC_QUEUE_RETRY_MARKER_POLL_INTERVAL_MS})
 */
@ConfigurationProperties(prefix = "yacc.queue.retry")
public record QueueRetryProperties(List<Long> backoffDelaysMs, Integer maxAttempts,
        Long markerPollIntervalMs) {

    /** Frozen backoff ladder (POC {@code RETRY_CONFIG.BACKOFF_DELAYS} parity). */
    public static final List<Long> DEFAULT_BACKOFF_DELAYS_MS =
            List.of(60_000L, 300_000L, 1_800_000L);

    /** Frozen attempts-per-cycle bound (POC {@code RETRY_CONFIG.MAX_ATTEMPTS} parity). */
    public static final int DEFAULT_MAX_ATTEMPTS = 3;

    /** Frozen marker-poll cadence default (hygiene value). */
    public static final long DEFAULT_MARKER_POLL_INTERVAL_MS = 30_000L;

    public QueueRetryProperties {
        if (backoffDelaysMs == null || backoffDelaysMs.isEmpty()) {
            backoffDelaysMs = DEFAULT_BACKOFF_DELAYS_MS;
        }
        if (maxAttempts == null || maxAttempts < 1) {
            maxAttempts = DEFAULT_MAX_ATTEMPTS;
        }
        if (markerPollIntervalMs == null || markerPollIntervalMs < 1) {
            markerPollIntervalMs = DEFAULT_MARKER_POLL_INTERVAL_MS;
        }
    }

    /**
     * Delay before redelivery attempt {@code attempt} (1-based) — the frozen
     * ladder: attempt 1 fires after 1m, attempt 2 after 5m, attempt 3 after
     * 30m. Beyond the configured ladder the last delay repeats (bounded
     * policy, never an unbounded explosion).
     */
    public long delayBeforeAttempt(int attempt) {
        int index = Math.min(Math.max(attempt, 1) - 1, backoffDelaysMs.size() - 1);
        return backoffDelaysMs.get(index);
    }
}
