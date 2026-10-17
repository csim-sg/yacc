package com.yacc.config;

import java.time.ZoneOffset;
import java.util.TimeZone;

import org.springframework.context.annotation.Configuration;

/**
 * MIG-102 (AC-MIG-102-4): pins the service's UTC time basis so the offset
 * stamped on the wire is truthful rather than assumed. Three coordinated
 * layers, each asserted by tests:
 *
 * <ol>
 *   <li><strong>boot anchoring (this class)</strong> — the JVM default zone is
 *       re-anchored to UTC in a static initializer, which runs while the
 *       context parses its configuration classes, i.e. before any bean
 *       (Hibernate, Quartz, bootstrap seed) reads the clock. {@code
 *       LocalDateTime.now()} write paths are therefore UTC wall-clock in
 *       every environment, including a developer laptop with no {@code TZ}
 *       set;</li>
 *   <li><strong>runtime/deployment pin</strong> — {@code ENV TZ=UTC} in
 *       {@code services/backend-java/Dockerfile} and {@code TZ: "UTC"} in the
 *       Helm values, so the container itself starts on UTC;</li>
 *   <li><strong>JDBC/DB session pin</strong> — {@code options=-c timezone=UTC}
 *       on the pooled connections ({@code application.yml}), asserted by the
 *       integration suite. ADR-027 {@code timestamp} (without time zone)
 *       columns bound as {@code LocalDateTime} are never converted in
 *       transit — the session pin makes that basis explicit and guards future
 *       zone-aware reads.</li>
 * </ol>
 *
 * <p>This is a JVM-envelope pin, not a data-model change: entity/DTO field
 * types stay {@link LocalDateTime} (ADR-027 surface untouched).</p>
 */
@Configuration
public class UtcTimeBasisConfig {

    static {
        anchorUtc();
    }

    /**
     * Idempotently anchors the JVM default zone to UTC. Package-visible so
     * tests can invoke and assert the anchoring directly.
     */
    static void anchorUtc() {
        TimeZone.setDefault(TimeZone.getTimeZone(ZoneOffset.UTC));
    }
}
