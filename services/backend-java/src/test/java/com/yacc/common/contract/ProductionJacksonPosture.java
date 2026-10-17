package com.yacc.common.contract;

import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.yacc.config.JacksonConfig;

/**
 * MIG-102 (AC-MIG-102-3): builds the production Jackson wire posture for the
 * contract conformance tests — the exact {@link JacksonConfig#customize}
 * customizer the Spring context applies to the auto-configured mapper shared
 * by the MVC message converters and the WebSocket publisher. No test-only
 * inclusion or format override exists anywhere;
 * {@code ProductionSerializationIntegrationTest} additionally proves the real
 * Spring {@code ObjectMapper} bean behaves identically.
 */
final class ProductionJacksonPosture {

    private ProductionJacksonPosture() {
    }

    /** The app-wide production mapper posture (same builder path as Boot). */
    static ObjectMapper productionMapper() {
        Jackson2ObjectMapperBuilder builder = Jackson2ObjectMapperBuilder.json();
        // Mirror Boot's JacksonAutoConfiguration FEATURE_DEFAULTS so the
        // builder-built mapper matches the auto-configured production bean
        // (ISO-8601 strings, no decimal timestamps — the envelope timestamp
        // depends on this).
        builder.featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS,
                SerializationFeature.WRITE_DURATIONS_AS_TIMESTAMPS);
        JacksonConfig.customize(builder);
        return builder.build();
    }
}
