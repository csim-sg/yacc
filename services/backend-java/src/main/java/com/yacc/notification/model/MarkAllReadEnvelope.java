package com.yacc.notification.model;

import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Bulk-mark envelope {@code {data: {markedCount}}} (POC parity; the frozen
 * contract types {@code data} as a loose object — documented JSON boundary).
 *
 * @param data bulk outcome
 */
public record MarkAllReadEnvelope(ObjectNode data) {
}
