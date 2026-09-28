package com.yacc.integration.model;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * IRC connection status model (frozen contract component
 * {@code IrcConnectionStatus}; POC {@code IRCConnectionStatusModel} parity).
 * Held in-memory by {@code IrcConnectionState} until the connector runtime
 * (MIG-061) drives it.
 *
 * @param status connected | retrying | disconnected | failed
 * @param attemptCount reconnect attempts in the current incident
 * @param lastConnectedAt last successful connection, null when never
 * @param lastError last failure reason, null when healthy
 * @param reconnectIncidentId incident id of the current reconnect cycle
 */
public record IrcConnectionStatus(
        String status,
        int attemptCount,
        LocalDateTime lastConnectedAt,
        String lastError,
        UUID reconnectIncidentId) {
}
