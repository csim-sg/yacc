package com.yacc.queue.model;

import java.util.List;

/**
 * Failure-pattern analysis (POC {@code analyzeDLQPatterns} parity).
 *
 * @param topFailureReasons        most frequent failure reasons
 * @param avgAttemptsBeforeFailure average attempts before dead-lettering
 * @param mostCommonError          most frequent error text
 * @param conversationCount        distinct affected conversations
 */
public record PatternAnalysis(List<ReasonCount> topFailureReasons, long avgAttemptsBeforeFailure,
        String mostCommonError, long conversationCount) {
}
