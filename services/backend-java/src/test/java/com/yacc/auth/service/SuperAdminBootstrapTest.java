package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import com.yacc.auth.AuthProperties;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

import static org.mockito.Mockito.times;

/**
 * Unit tests for the deterministic first-run Super Admin bootstrap
 * (AC-MIG-030-4; ADR-025): creation on an admin-less database, idempotent
 * no-op when a SUPER_ADMIN exists, and fail-closed handling of missing or
 * conflicting configuration.
 */
@ExtendWith(MockitoExtension.class)
class SuperAdminBootstrapTest {

    private static final String BOOTSTRAP_EMAIL = "bootstrap@fixture.yacc.local";
    private static final String INITIAL_CREDENTIAL = "one-time-initial-credential";

    @Mock
    private UserRepository users;

    @Mock
    private AuditPersistence audit;

    @Captor
    private ArgumentCaptor<AuditRecord> auditCaptor;

    @Captor
    private ArgumentCaptor<User> userCaptor;

    private SuperAdminBootstrap bootstrap;

    @BeforeEach
    void setUp() {
        SuperAdminProvisioner provisioner =
                new SuperAdminProvisioner(users, new BCryptPasswordEncoder());
        bootstrap = new SuperAdminBootstrap(users, provisioner,
                new AuthProperties(
                        new AuthProperties.Token("ignored", null, null),
                        new AuthProperties.Bootstrap(BOOTSTRAP_EMAIL, INITIAL_CREDENTIAL),
                        new AuthProperties.Recovery("", "", "")),
                audit);
    }

    @Test
    void createsExactlyOneForcedChangeSuperAdminOnEmptyDatabase() {
        when(users.existsByRole(UserRole.SUPER_ADMIN)).thenReturn(false);
        when(users.findByEmail(BOOTSTRAP_EMAIL)).thenReturn(Optional.empty());
        when(users.findById(any())).thenReturn(Optional.empty());
        when(users.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        bootstrap.run(new DefaultApplicationArguments());

        verify(users).save(argThat(saved -> saved.getRole() == UserRole.SUPER_ADMIN
                && saved.isMustChangePassword()
                && saved.getEmail().equals(BOOTSTRAP_EMAIL)));
        verify(audit).persist(auditCaptor.capture());
        assertThat(auditCaptor.getValue().action()).isEqualTo("bootstrap.super_admin.created");
    }

    @Test
    void secondStartupIsANoOp() {
        when(users.existsByRole(UserRole.SUPER_ADMIN)).thenReturn(true);

        bootstrap.run(new DefaultApplicationArguments());

        verify(users, never()).save(any());
        verify(audit, never()).persist(any());
    }

    @Test
    void missingConfigurationFailsStartup() {
        SuperAdminBootstrap unconfigured = new SuperAdminBootstrap(users,
                new SuperAdminProvisioner(users, new BCryptPasswordEncoder()),
                new AuthProperties(
                        new AuthProperties.Token("ignored", null, null),
                        new AuthProperties.Bootstrap("", ""),
                        new AuthProperties.Recovery("", "", "")),
                audit);
        when(users.existsByRole(UserRole.SUPER_ADMIN)).thenReturn(false);

        assertThatThrownBy(() -> unconfigured.run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL");

        verify(users, never()).save(any());
    }

    @Test
    void conflictingBootstrapEmailFailsStartup() {
        when(users.existsByRole(UserRole.SUPER_ADMIN)).thenReturn(false);
        when(users.findByEmail(BOOTSTRAP_EMAIL)).thenReturn(Optional.of(
                new User("user-1", BOOTSTRAP_EMAIL, "Someone", "hash",
                        UserRole.USER, UserStatus.ACTIVE, true)));

        assertThatThrownBy(() -> bootstrap.run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already registered");

        verify(users, never()).save(any());
    }

    @Test
    void deterministicIdentitiesForSameEmail() {
        when(users.existsByRole(UserRole.SUPER_ADMIN)).thenReturn(false);
        when(users.findByEmail(BOOTSTRAP_EMAIL)).thenReturn(Optional.empty());
        when(users.findById(any())).thenReturn(Optional.empty());
        when(users.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        bootstrap.run(new DefaultApplicationArguments());
        bootstrap.run(new DefaultApplicationArguments());

        // Same inputs → same identity: both provisioning passes derive the
        // same name-based uuid, so the saved identity is stable.
        verify(users, times(2)).save(userCaptor.capture());
        assertThat(userCaptor.getAllValues().get(0).getId())
                .isEqualTo(userCaptor.getAllValues().get(1).getId());
    }
}
