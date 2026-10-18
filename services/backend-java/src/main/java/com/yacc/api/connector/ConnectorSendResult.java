package com.yacc.api.connector;

import java.time.LocalDateTime;

/**
 * Connector send outcome (POC {@code SendResult}/{@code SendMessageResponse}
 * parity): success carries the platform message id; failure carries the
 * typed error. Exactly one of {@code externalMessageId}/{@code error} is
 * populated, keyed by {@code success}.
 *
 * @param success           whether the platform accepted the message
 * @param externalMessageId platform message id ({@code "unknown"} when the
 *                          platform response carries no id, baseline parity)
 * @param error             typed failure (null on success)
 * @param sentAt            attempt time (server clock)
 */
public record ConnectorSendResult(
        boolean success,
        String externalMessageId,
        SendError error,
        LocalDateTime sentAt) {

    /** Success result (platform message id populated). */
    public static ConnectorSendResult success(String externalMessageId, LocalDateTime sentAt) {
        return new ConnectorSendResult(true, externalMessageId, null, sentAt);
    }

    /** Failure result (typed error populated). */
    public static ConnectorSendResult failure(SendError error, LocalDateTime sentAt) {
        return new ConnectorSendResult(false, null, error, sentAt);
    }

    /**
     * Typed send failure (POC {@code SendError} parity).
     *
     * @param code      typed error code
     * @param message   human-readable failure description (never contains
     *                  credentials)
     * @param retryable baseline semantics: {@code RATE_LIMIT} and
     *                  {@code NETWORK_ERROR} only
     */
    public record SendError(ConnectorErrorCode code, String message, boolean retryable) {

        public static SendError of(ConnectorErrorCode code, String message) {
            return new SendError(code, message, code.isRetryable());
        }
    }
}
