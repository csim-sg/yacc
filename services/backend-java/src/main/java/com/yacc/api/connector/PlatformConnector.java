package com.yacc.api.connector;

import java.util.List;

/**
 * The one minimal platform-neutral connector seam (MIG-062; guardrail G1) —
 * a single interface over the two existing connectors, whose method sets
 * already match exactly. Deliberately NOT a plugin framework: no plugin
 * loader, no per-adapter config-schema machinery, no multi-profile key
 * index (IRC multi-profile resolution lives in
 * {@link IrcConnectionConfigResolver}, MIG-061), no reflection, no
 * hierarchy — the POC registry's production surface was only
 * {@code register}/{@code getPlatforms}/{@code disconnectAll}
 * ({@code integrations-runtime.service.ts}) and the binding ledger has zero
 * registry-internal rows (SPEC-002 TR-09; ARCH-004 §1).
 */
public interface PlatformConnector {

    /** Connects to the platform (DB-first credential resolution inside). */
    void connect();

    /** Disconnects and discards in-memory connection state. */
    void disconnect();

    /**
     * Sends one outbound message (baseline result/error mapping parity:
     * failures return a typed-failure result, never throw).
     */
    ConnectorSendResult sendMessage(ConnectorOutboundMessage request);

    /** Connection status snapshot. */
    ConnectorStatus status();

    /** Health snapshot (baseline {@code healthCheck} parity). */
    ConnectorHealth health();

    /** Baseline adapter capabilities list. */
    List<String> capabilities();
}
