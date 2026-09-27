package com.yacc.dlq.model;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * DLQ statistics payload.
 *
 * @param total           entry count
 * @param byFailureReason counts keyed by failure reason
 * @param oldest          earliest moved-at
 * @param newest          latest moved-at
 */
public record DlqStatistics(long total, Map<String, Long> byFailureReason,
        LocalDateTime oldest, LocalDateTime newest) {
}
