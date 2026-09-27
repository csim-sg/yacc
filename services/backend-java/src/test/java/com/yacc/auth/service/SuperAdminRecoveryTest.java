package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
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

/**
 * Unit tests for the founder-controlled recovery gate (AC-MIG-030-4;
 * ADR-025): dormant when unset, fail-closed on wrong/missing key material,
 * and on success re-provisions the Super Admin with a fresh credential,
 * forced password change, and an audit record.
 */
@ExtendWith(MockitoExtension.class)
class SuperAdminRecoveryTest {

    private static final String RECOVERY_SECRET = "founder-held-recovery-secret";
    private static final String BOOTSTRAP_EMAIL = "bootstrap@fixture.yacc.local";
    private static final String FRESH_CREDENTIAL = "fresh-one-time-credential";

    @Mock
    private UserRepository users;

    @Mock
    private AuditPersistence audit;

    @Captor
    private ArgumentCaptor<AuditRecord> auditCaptor;

    private SuperAdminRecovery recovery(String mode, String key, String keyHash) {
        SuperAdminProvisioner provisioner =
                new SuperAdminProvisioner(users, new BCryptPasswordEncoder());
        return new SuperAdminRecovery(
                new AuthProperties(
                        new AuthProperties.Token("ignored", null, null),
                        new AuthProperties.Bootstrap(BOOTSTRAP_EMAIL, FRESH_CREDENTIAL),
                        new AuthProperties.Recovery(mode, key, keyHash), null, null, null, null),
                provisioner,
                audit);
    }

    private static String sha256Hex(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void dormantWhenModeUnset() {
        recovery("", "", "").run(new DefaultApplicationArguments());

        verify(users, never()).save(any());
        verify(audit, never()).persist(any());
    }

    @Test
    void reprovisionsSuperAdminOnValidFounderKey() {
        User demoted = new User("user-1", BOOTSTRAP_EMAIL, "Super Admin", "hash",
                UserRole.USER, UserStatus.SUSPENDED, true);
        demoted.setMustChangePassword(false);
        when(users.findById(any())).thenReturn(Optional.of(demoted));
        when(users.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        recovery("once", RECOVERY_SECRET, sha256Hex(RECOVERY_SECRET))
                .run(new DefaultApplicationArguments());

        // Re-provisioned: SUPER_ADMIN role, ACTIVE status, forced change —
        // a fresh credential, never a restored old one.
        assertThat(demoted.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
        assertThat(demoted.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(demoted.isMustChangePassword()).isTrue();
        verify(audit).persist(auditCaptor.capture());
        assertThat(auditCaptor.getValue().action())
                .isEqualTo("recovery.super_admin.reprovisioned");
    }

    @Test
    void wrongKeyFailsStartup() {
        assertThatThrownBy(() -> recovery("once", "wrong-secret", sha256Hex(RECOVERY_SECRET))
                .run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("does not match");

        verify(users, never()).save(any());
    }

    @Test
    void missingKeyMaterialFailsStartup() {
        assertThatThrownBy(() -> recovery("once", "", sha256Hex(RECOVERY_SECRET))
                .run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("RECOVERY_KEY");

        verify(users, never()).save(any());
    }

    @Test
    void unknownModeFailsStartup() {
        assertThatThrownBy(() -> recovery("always-on", RECOVERY_SECRET, sha256Hex(RECOVERY_SECRET))
                .run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("once");

        verify(users, never()).save(any());
    }
}
