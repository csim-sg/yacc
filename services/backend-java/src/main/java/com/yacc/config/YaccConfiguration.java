package com.yacc.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Platform configuration (guardrails 004 §4): declares singleton beans only
 * and contains no business logic.
 *
 * <p>Dependencies are received as constructor-style parameters on the
 * {@code @Bean} factory method — constructor injection only, no field
 * injection anywhere in the codebase (SPEC-002 TR-02).</p>
 */
@Configuration
public class YaccConfiguration {

    private static final Logger log = LoggerFactory.getLogger(YaccConfiguration.class);

    @Bean
    ApplicationRunner startupLogger(YaccProperties properties) {
        return args -> log.info("YACC backend started (environment={})", properties.environment());
    }
}
