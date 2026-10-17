package com.yacc.config;

import java.time.LocalDateTime;

import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

/**
 * MIG-102 (AC-MIG-102-1..3; ADR-023 contract-first): the single app-wide
 * Jackson wire-serialization posture.
 *
 * <p>The customizer mutates the auto-configured {@code ObjectMapper} — the
 * one instance Spring MVC's message converters, the WebSocket event publisher
 * and every injected {@code ObjectMapper} consumer share — so there is no
 * per-controller, per-endpoint or per-mapper formatting anywhere (ARCH-004
 * §3/§12). Frozen-contract effect:</p>
 *
 * <ul>
 *   <li>every {@link LocalDateTime} member serializes as RFC 3339 with an
 *       explicit UTC offset ({@code 2026-10-16T08:00:00Z}), matching the
 *       {@code format: date-time} contract members and the captured JS
 *       baseline ({@code new Date().toISOString()});</li>
 *   <li>no global inclusion override is set — members that are
 *       {@code required} and nullable stay explicit {@code null} on the wire
 *       (Message.senderId/metadata, AuditLog.actorId,
 *       AssignmentResponse.previouslyAssignedUserId, UserResponse.deletedAt);
 *       optional non-nullable members omit only via narrow per-record/per-
 *       member {@code @JsonInclude(NON_NULL)} where the contract allows
 *       absence.</li>
 * </ul>
 *
 * <p>{@link #customize} is static and reused verbatim by the contract
 * conformance tests, so the tests exercise exactly the shipped posture.</p>
 */
@Configuration
public class JacksonConfig {

    @Bean
    Jackson2ObjectMapperBuilderCustomizer yaccWireSerializationCustomizer() {
        return JacksonConfig::customize;
    }

    /**
     * Applies the production wire-serialization posture to a builder. Used by
     * Spring Boot (via the customizer bean) and by the contract tests (via
     * {@code ProductionJacksonPosture}) — one source, no test-only override.
     */
    public static void customize(Jackson2ObjectMapperBuilder builder) {
        builder.serializerByType(LocalDateTime.class,
                new Rfc3339UtcLocalDateTimeSerializer());
        builder.deserializerByType(LocalDateTime.class,
                new Rfc3339UtcLocalDateTimeDeserializer());
    }
}
