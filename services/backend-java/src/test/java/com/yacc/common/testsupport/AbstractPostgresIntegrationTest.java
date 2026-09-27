package com.yacc.common.testsupport;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Reusable base for integration tests that need the real PostgreSQL data layer
 * (SPEC-002 MIG-014; ADR-027 — the Testcontainers PostgreSQL harness reproduces
 * the data layer).
 *
 * <p>The pinned {@code postgres:15-alpine} container matches the POC runtime
 * PostgreSQL major version. It is started once per test-JVM run in a static
 * initializer and shared by all subclasses: with Spring context caching, a
 * per-class container restart would strand earlier cached contexts on a dead
 * port (observed with the second harness subclass introduced in MIG-020), so
 * the container is deliberately never stopped per class. The connection
 * properties are exported via {@link DynamicPropertySource} — the classic
 * singleton-container alternative to {@code @ServiceConnection}, which needs
 * the per-class JUnit extension lifecycle that caching cannot survive.</p>
 *
 * <p>Test conventions for all YACC tests (ARCH-004 §13 #10; MIG-014
 * tech-lead guardrails): external adapters — Telegram, IRC, S3/R2, mail —
 * must be mocked with Mockito (e.g. {@code @MockitoBean} in Spring context
 * tests); tests never contact real adapters or external network services.
 * The {@code test} profile (application-test.yml) is deterministic and must
 * stay free of environment-specific values.</p>
 */
@SpringBootTest
@ActiveProfiles("test")
public abstract class AbstractPostgresIntegrationTest {

    protected static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:15-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void postgresConnection(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
