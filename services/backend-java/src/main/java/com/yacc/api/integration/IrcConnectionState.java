package com.yacc.api.integration;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.yacc.api.integration.IrcConnectionStatus;

/**
 * In-memory IRC connection state holder (POC {@code ircIntegration.service}
 * status-model parity). The REST surface reads it and the manual-connect
 * flow resets it; the MIG-061 connector runtime owns the live transitions.
 * Single-instance deployment (ADR-024) makes the in-memory model the
 * simplest correct holder.
 */
@Component
public class IrcConnectionState {

    private volatile String status = "disconnected";
    private volatile int attemptCount;
    private volatile LocalDateTime lastConnectedAt;
    private volatile String lastError;
    private volatile UUID reconnectIncidentId;

    /** Current status snapshot (never exposes configuration secrets). */
    public IrcConnectionStatus snapshot() {
        return new IrcConnectionStatus(status, attemptCount, lastConnectedAt, lastError,
                reconnectIncidentId);
    }

    /** Manual-connect semantics: always retrying with attemptCount 0. */
    public synchronized void setManualRetrying() {
        this.status = "retrying";
        this.attemptCount = 0;
        if (this.reconnectIncidentId == null) {
            this.reconnectIncidentId = UUID.randomUUID();
        }
    }

    /**
     * Connector-side transition to retrying at attempt N of the current
     * incident (MIG-061 runtime parity of the baseline reconnect cycle).
     * A fresh incident id is minted exactly when the first retry of an
     * incident is reported (attempt 0 → 1 transition); subsequent attempts
     * of the same incident keep it stable.
     */
    public synchronized void markRetrying(int attempts) {
        this.status = "retrying";
        this.attemptCount = attempts;
        if (attempts <= 0 || this.reconnectIncidentId == null) {
            this.reconnectIncidentId = UUID.randomUUID();
        }
    }

    /** Connector-side transition to connected (MIG-061 drives this). */
    public synchronized void markConnected() {
        this.status = "connected";
        this.attemptCount = 0;
        this.lastConnectedAt = LocalDateTime.now();
        this.lastError = null;
        // No reconnect cycle is current while connected (frozen contract:
        // reconnectIncidentId is the id of the *current* cycle).
        this.reconnectIncidentId = null;
    }

    /** Connector-side transition to disconnected (manual disconnect). */
    public synchronized void markDisconnected() {
        this.status = "disconnected";
        this.attemptCount = 0;
    }

    /** Connector-side transition to failed. */
    public synchronized void markFailed(int attempts, String error) {
        this.status = "failed";
        this.attemptCount = attempts;
        this.lastError = error;
    }
}
