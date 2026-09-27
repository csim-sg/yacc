package com.yacc.common.testsupport;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Reusable base for integration tests that need the real PostgreSQL data layer
 * (SPEC-002 MIG-014; ADR-027 — the Testcontainers PostgreSQL harness reproduces
 * the data layer).
 *
 * <p>The pinned {@code postgres:15-alpine} container matches the POC runtime
 * PostgreSQL major version and is wired into the Spring context via
 * {@code @ServiceConnection}, so subclasses need no datasource configuration.
 * The container field is static: one instance is started per test-JVM run and
 * shared by all subclasses.</p>
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
@Testcontainers
public abstract class AbstractPostgresIntegrationTest {

    @Container
    @ServiceConnection
    protected static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:15-alpine");
}
