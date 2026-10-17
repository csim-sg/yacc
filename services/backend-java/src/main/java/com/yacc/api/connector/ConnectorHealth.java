package com.yacc.api.connector;

import java.time.LocalDateTime;

/**
 * Connector health snapshot (POC {@code HealthCheckResult} parity).
 *
 * @param healthy       {@code true} only when connected
 * @param details       failure detail when unhealthy (baseline
 *                      {@code "Status: <status>"} shape), null when healthy
 * @param lastMessageAt last inbound message time for staleness detection
 */
public record ConnectorHealth(boolean healthy, String details, LocalDateTime lastMessageAt) {
}
