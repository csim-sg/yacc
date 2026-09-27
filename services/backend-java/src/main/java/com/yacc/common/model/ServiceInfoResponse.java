package com.yacc.common.model;

/**
 * Service metadata payload (MIG-010 scaffold).
 *
 * @param name        service name from {@code yacc.name}
 * @param environment deployment environment from {@code yacc.environment}
 */
public record ServiceInfoResponse(String name, String environment) {
}
