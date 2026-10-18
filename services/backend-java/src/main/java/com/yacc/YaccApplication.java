package com.yacc;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * YACC Java/Spring backend entrypoint (SPEC-002, MIG-010 scaffold).
 *
 * <p>Standalone API modules + shared planes per ADR-030 (as amended by
 * MIG-100): {@code api.auth}, {@code api.user}, {@code api.conversation},
 * {@code api.message}, {@code api.note}, {@code api.tag},
 * {@code api.routingrule}, {@code api.notification}, {@code api.audit},
 * {@code api.dlq}, {@code api.queue}, {@code api.integration},
 * {@code api.realtime} ({@code api.connector} when Phase 6 connectors land),
 * plus the shared {@code entity}, {@code repository}, {@code service},
 * {@code config}, {@code common} planes. Component scanning wires feature
 * beans; no central registry exists.</p>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class YaccApplication {

    public static void main(String[] args) {
        SpringApplication.run(YaccApplication.class, args);
    }
}
