package com.yacc.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Platform-wide environment binding (guardrails 004 §4; ADR-030 §4).
 *
 * <p>The {@code config} package holds only platform-wide
 * {@code @ConfigurationProperties} types and singleton {@code @Bean}
 * declarations. Feature-specific configuration classes are colocated in
 * their own feature package; no static or {@code System.getenv()} config
 * reads exist anywhere else.</p>
 *
 * @param name        service name (e.g. {@code yacc-backend})
 * @param environment deployment environment name (e.g. {@code local},
 *                     {@code staging}, {@code production})
 */
@ConfigurationProperties(prefix = "yacc")
public record YaccProperties(String name, String environment) {
}
