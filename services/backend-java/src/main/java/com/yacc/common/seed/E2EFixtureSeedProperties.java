package com.yacc.common.seed;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Opt-in gate of the E2E fixture-seed entrypoint (PREREQ-ANG-003-S1; SPEC-003
 * AD-5; ARCH-004 §4 — typed {@code @ConfigurationProperties}, never scattered
 * {@code @Value} reads). The {@code e2e} profile alone never seeds: activation
 * additionally requires this explicit opt-in property and the non-production
 * datasource guard enforced by {@link E2EFixtureSeed}. Any unmet condition
 * fails closed with an explicit error — the seed never runs partially.
 *
 * @param seedEnabled explicit opt-in flag ({@code yacc.e2e.seed-enabled});
 *                    {@code false} (the default) keeps the entrypoint inert
 */
@ConfigurationProperties(prefix = "yacc.e2e")
public record E2EFixtureSeedProperties(boolean seedEnabled) {

    /** The wire name of the opt-in property (for fail-closed error messages). */
    public static final String OPT_IN_PROPERTY = "yacc.e2e.seed-enabled";
}
