package com.yacc.integration.model;

/**
 * Stored-credential profile test outcome (POC {@code TestConnectionResult}
 * parity; renamed from the in-service {@code TestResult} on extraction so
 * the two IRC test outcomes stay distinct in {@code model}).
 *
 * @param passed     connection established
 * @param reason     human-readable outcome
 * @param durationMs elapsed milliseconds
 */
public record ProfileTestResult(boolean passed, String reason, long durationMs) {
}
