package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

import com.yacc.auth.model.UserRole;
import com.yacc.auth.repository.UserRepository;
import com.yacc.auth.service.SuperAdminBootstrap;

/**
 * Bootstrap-from-empty demonstration (AC-MIG-030-4; ADR-025; SPEC AC-08):
 * boots the FULL application — Flyway migrations, JPA, security chain,
 * runners — against a dedicated empty PostgreSQL container, proving the
 * deterministic first-run Super Admin bootstrap end to end:
 *
 * <ol>
 *   <li>a fresh full-reset database contains zero identities;</li>
 *   <li>application startup creates exactly one SUPER_ADMIN from the
 *       bootstrap configuration, with the forced-password-change flag set;</li>
 *   <li>a second bootstrap pass is an idempotent no-op;</li>
 *   <li>the identity is deterministic — the derived uuid is stable.</li>
 * </ol>
 *
 * <p>Recovery (the second ADR-025 mechanism) is unit-covered in
 * {@code SuperAdminRecoveryTest}; the live recovery drill belongs to
 * MIG-071.</p>
 */
@SpringBootTest(properties = {
        "yacc.auth.bootstrap.email=founder-bootstrap@reset.yacc.local",
        "yacc.auth.bootstrap.initial-credential=reset-time-one-time-credential"
})
@ActiveProfiles("test")
class SuperAdminBootstrapIntegrationTest {

    private static final PostgreSQLContainer<?> EMPTY_DB =
            new PostgreSQLContainer<>("postgres:15-alpine");

    static {
        EMPTY_DB.start();
    }

    @DynamicPropertySource
    static void emptyDatabase(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", EMPTY_DB::getJdbcUrl);
        registry.add("spring.datasource.username", EMPTY_DB::getUsername);
        registry.add("spring.datasource.password", EMPTY_DB::getPassword);
    }

    private final UserRepository users;

    private final SuperAdminBootstrap bootstrap;

    /**
     * Constructor injection only (guardrails 004 §2; ADR-024; ADR-030):
     * the single {@code @Autowired}-annotated constructor — never field
     * injection.
     */
    @Autowired
    SuperAdminBootstrapIntegrationTest(UserRepository users, SuperAdminBootstrap bootstrap) {
        this.users = users;
        this.bootstrap = bootstrap;
    }

    @Test
    void bootstrapsExactlyOneForcedChangeSuperAdminFromAnEmptyDatabase() {
        // The startup runner already executed against the empty database.
        assertThat(users.count()).isEqualTo(1);

        var superAdmin = users.findAll().iterator().next();
        assertThat(superAdmin.getEmail()).isEqualTo("founder-bootstrap@reset.yacc.local");
        assertThat(superAdmin.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
        assertThat(superAdmin.getStatus()).isEqualTo(com.yacc.auth.model.UserStatus.ACTIVE);
        assertThat(superAdmin.isMustChangePassword()).isTrue();
        String deterministicId = superAdmin.getId();

        // Second startup pass: idempotent no-op, identity unchanged.
        bootstrap.run(new org.springframework.boot.DefaultApplicationArguments());
        assertThat(users.count()).isEqualTo(1);
        assertThat(users.findAll().iterator().next().getId()).isEqualTo(deterministicId);
    }
}
