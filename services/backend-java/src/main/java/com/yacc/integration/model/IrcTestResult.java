package com.yacc.integration.model;

/**
 * IRC config test outcome (renamed from the in-service {@code TestResult}
 * on extraction so the two IRC test outcomes stay distinct in
 * {@code model}).
 *
 * @param success connection established
 * @param message sanitized result message
 * @param source  body | db | env
 */
public record IrcTestResult(boolean success, String message, String source) {
}
