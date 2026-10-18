package com.yacc.api.dlq;

/**
 * Re-queue outcome (POC parity shape).
 *
 * @param message human-readable confirmation
 * @param entry   updated entry
 */
public record ReQueueResponse(String message, DlqEntryResponse entry) {
}
