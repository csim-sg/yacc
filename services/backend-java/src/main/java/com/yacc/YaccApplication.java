package com.yacc;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * YACC Java/Spring backend entrypoint (SPEC-002, MIG-010 scaffold).
 *
 * <p>Package-by-feature layout per ADR-030: {@code auth}, {@code user},
 * {@code conversation}, {@code message}, {@code note}, {@code tag},
 * {@code routingrule}, {@code notification}, {@code audit}, {@code dlq},
 * {@code queue}, {@code integration}, {@code realtime}, {@code connector},
 * {@code config}, {@code common}. Component scanning wires feature beans;
 * no central registry exists.</p>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class YaccApplication {

    public static void main(String[] args) {
        SpringApplication.run(YaccApplication.class, args);
    }
}
