package com.yacc.api.connector;

/**
 * Connector connection lifecycle status (POC {@code ConnectorStatus}/
 * {@code AdapterStatus} parity: {@code disconnected}, {@code connecting},
 * {@code connected}, {@code error}). Consumed by the connector status
 * surface; the WS bridge ops and rooms are MIG-062 scope.
 */
public enum ConnectorStatus {

    DISCONNECTED,

    CONNECTING,

    CONNECTED,

    ERROR
}
