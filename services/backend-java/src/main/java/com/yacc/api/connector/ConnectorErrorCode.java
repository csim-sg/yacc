package com.yacc.api.connector;

/**
 * Typed platform error codes for connector adapter failures (POC
 * {@code gateway.types.ts} {@code SendError['code']} union parity). The
 * baseline retryability rule ({@code retryable = RATE_LIMIT ||
 * NETWORK_ERROR}) is carried by {@link #isRetryable()} so every typed
 * error reports consistent semantics.
 */
public enum ConnectorErrorCode {

    RATE_LIMIT,

    INVALID_CREDENTIALS,

    NETWORK_ERROR,

    MESSAGE_TOO_LONG,

    ATTACHMENT_TOO_LARGE,

    UNKNOWN_ERROR;

    /**
     * Baseline retryability parity: only rate limits and transport failures
     * are retryable (MIG-063 owns what retry actually does).
     */
    public boolean isRetryable() {
        return this == RATE_LIMIT || this == NETWORK_ERROR;
    }
}
