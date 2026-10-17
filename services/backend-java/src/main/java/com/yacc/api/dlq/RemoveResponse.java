package com.yacc.api.dlq;

/**
 * Removal outcome (POC parity shape).
 *
 * @param message      human-readable confirmation
 * @param deletedEntry removed entry identity
 */
public record RemoveResponse(String message, RemovedEntry deletedEntry) {
}
