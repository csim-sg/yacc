package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.yacc.auth.AuthProperties;
import com.yacc.auth.model.PasswordResetToken;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.PasswordResetTokenRepository;
import com.yacc.auth.repository.UserRepository;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Unit tests for the password-reset flow (MIG-031; AC-MIG-031-1/-2; BE-003
 * parity): 256-bit single-use tokens stored as bcrypt digests, expiration,
 * atomic consumption with replay rejection, anti-enumeration no-op for
 * unknown addresses, and the recovery completion semantics — fresh
 * credential (never an old one), forced-password-change cleared, every
 * refresh grant revoked, audit parity.
 */
@ExtendWith(MockitoExtension.class)
class PasswordResetServiceTest {

    private static final String EMAIL = "resetter@fixture.yacc.local";

    @Mock
    private UserRepository users;

    @Mock
    private PasswordResetTokenRepository resetTokens;

    @Mock
    private SessionService sessions;

    @Mock
    private AuthEmailService emails;

    @Mock
    private AuditPersistence audit;

    @Captor
    private ArgumentCaptor<PasswordResetToken> storedTokenCaptor;

    @Captor
    private ArgumentCaptor<String> emailedTokenCaptor;

    @Captor
    private ArgumentCaptor<AuditRecord> auditCaptor;

    private PasswordEncoder passwordEncoder;

    private PasswordResetService service;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        service = new PasswordResetService(users, resetTokens, passwordEncoder,
                sessions, emails, new AuthProperties(null, null, null, null, null, null, null, null),
                audit);
    }

    private User user() {
        return new User("user-1", EMAIL, "Resetter",
                passwordEncoder.encode("old-password-123"),
                UserRole.USER, UserStatus.ACTIVE, true);
    }

    private PasswordResetToken storedToken(User user, String rawToken,
            LocalDateTime expiresAt) {
        return new PasswordResetToken(user.getId(),
                passwordEncoder.encode(rawToken), expiresAt);
    }

    @Test
    void initiateForUnknownAddressIsASilentNoOp() {
        when(users.findByEmail("ghost@fixture.yacc.local")).thenReturn(Optional.empty());

        service.initiate("ghost@fixture.yacc.local");

        verify(resetTokens, never()).save(any());
        verify(emails, never()).sendPasswordResetEmail(anyString(), anyString());
        verify(audit, never()).persist(any());
    }

    @Test
    void initiateStoresOnlyTheDigestAndEmailsTheRawToken() {
        User user = user();
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        service.initiate(EMAIL);

        verify(resetTokens).deleteByUserIdAndUsedAtIsNull(user.getId());
        verify(resetTokens).save(storedTokenCaptor.capture());
        PasswordResetToken saved = storedTokenCaptor.getValue();
        assertThat(saved.getUserId()).isEqualTo(user.getId());
        // Only the bcrypt digest is stored (60-char $2 hash) — never the
        // raw token (BE-003 parity: tokens hashed in database).
        assertThat(saved.getToken()).startsWith("$2").hasSize(60);
        verify(emails).sendPasswordResetEmail(eq(EMAIL),
                emailedTokenCaptor.capture());
        String rawToken = emailedTokenCaptor.getValue();
        // The raw token is 64-char hex (256-bit entropy) and matches the
        // stored digest.
        assertThat(rawToken).matches("[0-9a-f]{64}");
        assertThat(passwordEncoder.matches(rawToken, saved.getToken())).isTrue();
        verify(audit).persist(auditCaptor.capture());
        assertThat(auditCaptor.getValue().action())
                .isEqualTo("password.reset_token_generated");
    }

    @Test
    void completeEmitsValidatedAndSuccessfulAuditEvents() {
        User user = user();
        String rawToken = "a".repeat(64);
        when(resetTokens.findByUsedAtIsNull()).thenReturn(
                List.of(storedToken(user, rawToken, LocalDateTime.now().plusMinutes(30))));
        when(resetTokens.markUsed(any(), any())).thenReturn(1);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        when(users.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.complete(rawToken, "fresh-password-456");

        // Recovery completion: fresh credential, forced-change cleared,
        // every refresh grant revoked, audit parity (validated + successful
        // events, POC vocabulary) (AC-MIG-031-2).
        verify(users).save(argThat(saved -> !saved.isMustChangePassword()));
        verify(sessions).revokeAllForUser(user.getId());
        verify(audit, org.mockito.Mockito.times(2)).persist(auditCaptor.capture());
        assertThat(auditCaptor.getAllValues())
                .extracting(AuditRecord::action)
                .containsExactly("password.reset_token_validated",
                        "password.reset_successful");
    }

    @Test
    void completeRejectsUnknownTokenWithTheGenericError() {
        when(resetTokens.findByUsedAtIsNull()).thenReturn(List.of());

        assertThatThrownBy(() -> service.complete("b".repeat(64), "fresh-password-456"))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessage("Invalid or expired token");
        verify(users, never()).save(any());
    }

    @Test
    void completeRejectsMalformedTokensWithoutTouchingTheDatabase() {
        assertThatThrownBy(() -> service.complete("not-a-token", "fresh-password-456"))
                .isInstanceOf(InvalidTokenException.class);
        assertThatThrownBy(() -> service.complete("ABC".repeat(22), "fresh-password-456"))
                .isInstanceOf(InvalidTokenException.class);
        verify(resetTokens, never()).findByUsedAtIsNull();
    }

    @Test
    void completeRejectsExpiredTokens() {
        User user = user();
        String rawToken = "c".repeat(64);
        when(resetTokens.findByUsedAtIsNull()).thenReturn(
                List.of(storedToken(user, rawToken, LocalDateTime.now().minusMinutes(1))));

        assertThatThrownBy(() -> service.complete(rawToken, "fresh-password-456"))
                .isInstanceOf(InvalidTokenException.class);
        verify(resetTokens, never()).markUsed(any(), any());
        verify(users, never()).save(any());
    }

    @Test
    void completeRejectsReplayedTokens() {
        // The atomic consumption update returns 0 — another request
        // already used the token; the replay is rejected with the same
        // generic error (single-use enforcement).
        User user = user();
        String rawToken = "d".repeat(64);
        when(resetTokens.findByUsedAtIsNull()).thenReturn(
                List.of(storedToken(user, rawToken, LocalDateTime.now().plusMinutes(30))));
        when(resetTokens.markUsed(any(), any())).thenReturn(0);

        assertThatThrownBy(() -> service.complete(rawToken, "fresh-password-456"))
                .isInstanceOf(InvalidTokenException.class);
        verify(users, never()).save(any());
    }

    @Test
    void completeNeverRestoresTheOldCredential() {
        // "No old credential restore" (AC-MIG-031-2): after completion the
        // stored hash verifies only the NEW credential — the old password
        // no longer matches anything on record.
        User user = user();
        String oldHash = user.getPasswordHash();
        String rawToken = "e".repeat(64);
        when(resetTokens.findByUsedAtIsNull()).thenReturn(
                List.of(storedToken(user, rawToken, LocalDateTime.now().plusMinutes(30))));
        when(resetTokens.markUsed(any(), any())).thenReturn(1);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        when(users.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.complete(rawToken, "brand-new-password-789");

        verify(users).save(argThat(saved -> {
            String savedHash = saved.getPasswordHash();
            return !savedHash.equals(oldHash)
                    && passwordEncoder.matches("brand-new-password-789", savedHash)
                    && !passwordEncoder.matches("old-password-123", savedHash);
        }));
    }
}
