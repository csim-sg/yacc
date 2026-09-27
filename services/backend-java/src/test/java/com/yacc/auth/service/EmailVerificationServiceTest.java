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
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.model.Verification;
import com.yacc.auth.repository.UserRepository;
import com.yacc.auth.repository.VerificationRepository;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Unit tests for the email-verification flow (MIG-031; AC-MIG-031-1):
 * hashed single-use challenge storage, expiration, consumption-by-deletion
 * replay rejection, the email_verified flip, and audit events.
 */
@ExtendWith(MockitoExtension.class)
class EmailVerificationServiceTest {

    private static final String EMAIL = "newcomer@fixture.yacc.local";

    @Mock
    private UserRepository users;

    @Mock
    private VerificationRepository verifications;

    @Mock
    private AuthEmailService emails;

    @Mock
    private AuditPersistence audit;

    @Captor
    private ArgumentCaptor<Verification> storedCaptor;

    @Captor
    private ArgumentCaptor<String> emailedTokenCaptor;

    @Captor
    private ArgumentCaptor<AuditRecord> auditCaptor;

    private PasswordEncoder passwordEncoder;

    private EmailVerificationService service;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        service = new EmailVerificationService(users, verifications, passwordEncoder,
                emails, new AuthProperties(null, null, null, null, null, null), audit);
    }

    private User user(boolean emailVerified) {
        return new User("user-1", EMAIL, "Newcomer",
                passwordEncoder.encode("password-123"),
                UserRole.USER, UserStatus.ACTIVE, emailVerified);
    }

    @Test
    void issueStoresOnlyTheDigestAndEmailsTheRawToken() {
        User user = user(false);

        service.issue(user);

        // One active challenge per address.
        verify(verifications).deleteByIdentifier(EMAIL);
        verify(verifications).save(storedCaptor.capture());
        Verification saved = storedCaptor.getValue();
        assertThat(saved.getIdentifier()).isEqualTo(EMAIL);
        assertThat(saved.getValue()).startsWith("$2").hasSize(60);
        verify(emails).sendVerificationEmail(eq(EMAIL), emailedTokenCaptor.capture());
        String rawToken = emailedTokenCaptor.getValue();
        assertThat(rawToken).matches("[0-9a-f]{64}");
        assertThat(passwordEncoder.matches(rawToken, saved.getValue())).isTrue();
        verify(audit).persist(auditCaptor.capture());
        assertThat(auditCaptor.getValue().action())
                .isEqualTo("email.verification_token_generated");
    }

    @Test
    void confirmFlipsEmailVerifiedAndConsumesTheChallenge() {
        String rawToken = "a".repeat(64);
        Verification challenge = new Verification("v-1", EMAIL,
                passwordEncoder.encode(rawToken), LocalDateTime.now().plusMinutes(30));
        User user = user(false);
        when(verifications.findAll()).thenReturn(List.of(challenge));
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(users.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.confirm(rawToken);

        // Consumption by deletion: a replayed token resolves to nothing.
        verify(verifications).delete(challenge);
        verify(users).save(argThat(saved -> saved.isEmailVerified()));
        verify(audit).persist(auditCaptor.capture());
        assertThat(auditCaptor.getValue().action())
                .isEqualTo("email.verification_successful");
    }

    @Test
    void confirmRejectsUnknownTokens() {
        when(verifications.findAll()).thenReturn(List.of());

        assertThatThrownBy(() -> service.confirm("b".repeat(64)))
                .isInstanceOf(InvalidTokenException.class)
                .hasMessage("Invalid or expired token");
        verify(users, never()).save(any());
    }

    @Test
    void confirmRejectsMalformedTokensWithoutTouchingTheDatabase() {
        assertThatThrownBy(() -> service.confirm("short-token"))
                .isInstanceOf(InvalidTokenException.class);
        verify(verifications, never()).findAll();
    }

    @Test
    void confirmRejectsExpiredTokens() {
        String rawToken = "c".repeat(64);
        Verification expired = new Verification("v-2", EMAIL,
                passwordEncoder.encode(rawToken), LocalDateTime.now().minusSeconds(1));
        when(verifications.findAll()).thenReturn(List.of(expired));

        assertThatThrownBy(() -> service.confirm(rawToken))
                .isInstanceOf(InvalidTokenException.class);
        verify(verifications, never()).delete(any());
        verify(users, never()).save(any());
    }

    @Test
    void confirmRejectsReplayedTokens() {
        // The challenge row was consumed by a prior confirmation; the row
        // no longer resolves, so the replay fails with the generic error.
        when(verifications.findAll()).thenReturn(List.of());

        assertThatThrownBy(() -> service.confirm("d".repeat(64)))
                .isInstanceOf(InvalidTokenException.class);
        verify(audit, never()).persist(argThat(record ->
                "email.verification_successful".equals(record.action())));
    }

    @Test
    void confirmFailsClosedWhenTheChallengeOwnerIsMissing() {
        String rawToken = "e".repeat(64);
        Verification challenge = new Verification("v-3", EMAIL,
                passwordEncoder.encode(rawToken), LocalDateTime.now().plusMinutes(30));
        when(verifications.findAll()).thenReturn(List.of(challenge));
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.confirm(rawToken))
                .isInstanceOf(InvalidTokenException.class);
        verify(users, never()).save(any());
    }
}
