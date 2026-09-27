package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.yacc.auth.AuthProperties;
import com.yacc.auth.model.AuthSessionResponse;
import com.yacc.auth.model.AuthSignOutResponse;
import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.ChangePasswordRequest;
import com.yacc.auth.model.RefreshTokenRequest;
import com.yacc.auth.model.Session;
import com.yacc.auth.model.SignInRequest;
import com.yacc.auth.model.SignUpRequest;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Unit tests for the local auth flows (AC-MIG-030-1/2; ADR-025): sign-in
 * with audit events, USER-only self-registration with no elevation path,
 * refresh-grant rotation with status enforcement, sign-out, and the
 * forced credential replacement.
 */
@ExtendWith(MockitoExtension.class)
class AuthenticationServiceTest {

    @Mock
    private UserRepository users;

    @Mock
    private AuthenticationManager authenticationManager;

    @Mock
    private SessionService sessions;

    @Mock
    private ApplicationEventPublisher events;

    @Mock
    private AuditPersistence audit;

    @Mock
    private EmailVerificationService emailVerification;

    @Captor
    private ArgumentCaptor<AuditRecord> auditCaptor;

    private PasswordEncoder passwordEncoder;

    private AuthenticationService service;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        service = new AuthenticationService(users, authenticationManager, passwordEncoder,
                sessions, mockJwtTokenService(), events, audit, emailVerification);
    }

    private JwtTokenService mockJwtTokenService() {
        String signingKey;
        try {
            java.security.KeyPairGenerator generator =
                    java.security.KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            signingKey = java.util.Base64.getEncoder()
                    .encodeToString(generator.generateKeyPair().getPrivate().getEncoded());
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
        return new JwtTokenService(new AuthProperties(
                new AuthProperties.Token(signingKey, null, null),
                new AuthProperties.Bootstrap("bootstrap@fixture.yacc.local", "initial"),
                new AuthProperties.Recovery("", "", ""), null, null, null));
    }

    private User persistedUser(String id, UserRole role, UserStatus status, String rawPassword) {
        return new User(id, "user@fixture.yacc.local", "Fixture",
                passwordEncoder.encode(rawPassword), role, status, true);
    }

    @Test
    void signInReturnsTokensAndUpdatesLoginStamp() {
        User user = persistedUser("user-1", UserRole.USER, UserStatus.ACTIVE, "password123");
        AuthUser principal = new AuthUser(user);
        Authentication authentication =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(sessions.issue(any())).thenReturn(new Session("session-1", "user-1",
                java.time.LocalDateTime.now().plusDays(30), "grant-token"));
        when(users.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        AuthSessionResponse response = service.signIn(
                new SignInRequest("user@fixture.yacc.local", "password123"));

        assertThat(response.user().id()).isEqualTo("user-1");
        assertThat(response.user().role()).isEqualTo("user");
        assertThat(response.refreshToken()).isEqualTo("grant-token");
        assertThat(response.accessToken()).isNotBlank();
        assertThat(response.mustChangePassword()).isFalse();
        verify(events).publishEvent(argThat(event -> event instanceof AuthenticationSuccessEvent));
        verify(users).save(argThat(saved -> saved.getLastLoginAt() != null));
    }

    @Test
    void signInFailureIsUniformAndAudited() {
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("nope"));

        assertThatThrownBy(() -> service.signIn(
                new SignInRequest("user@fixture.yacc.local", "wrong-password")))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Invalid credentials");

        verify(events).publishEvent(argThat(event -> event instanceof AuthenticationFailureBadCredentialsEvent));
    }

    @Test
    void signUpCreatesUserRoleOnly() {
        when(users.findByEmail("new@fixture.yacc.local")).thenReturn(Optional.empty());
        when(users.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(sessions.issue(any())).thenReturn(new Session("session-2", "user-2",
                java.time.LocalDateTime.now().plusDays(30), "grant-token"));

        // A malicious client tries to smuggle a privileged role/status — the
        // request record carries no such field; the service pins the values.
        AuthSessionResponse response = service.signUp(
                new SignUpRequest("new@fixture.yacc.local", "password123", "Newcomer"));

        assertThat(response.user().role()).isEqualTo("user");
        assertThat(response.user().status()).isEqualTo("active");
        assertThat(response.mustChangePassword()).isFalse();
        verify(users).save(argThat(saved -> saved.getRole() == UserRole.USER
                && saved.getStatus() == UserStatus.ACTIVE
                && !saved.isMustChangePassword()));
        verify(audit).persist(auditCaptor.capture());
        assertThat(auditCaptor.getValue().action()).isEqualTo("user.registered");
        // MIG-031: registration issues the email-verification challenge.
        verify(emailVerification).issue(any(User.class));
    }

    @Test
    void signUpDuplicateEmailFailsGenerically() {
        when(users.findByEmail("taken@fixture.yacc.local"))
                .thenReturn(Optional.of(persistedUser("user-1", UserRole.USER, UserStatus.ACTIVE, "password123")));

        assertThatThrownBy(() -> service.signUp(
                new SignUpRequest("taken@fixture.yacc.local", "password123", "Dup")))
                .isInstanceOf(EmailAlreadyRegisteredException.class)
                .hasMessage("Validation error");

        verify(users, never()).save(any());
    }

    @Test
    void refreshRotatesGrantForActiveOwner() {
        Session presented = new Session("session-1", "user-1",
                java.time.LocalDateTime.now().plusDays(1), "old-grant");
        when(sessions.findValid("old-grant")).thenReturn(Optional.of(presented));
        when(users.findById("user-1")).thenReturn(Optional.of(
                persistedUser("user-1", UserRole.USER, UserStatus.ACTIVE, "password123")));
        when(sessions.rotate(eq(presented), any(User.class)))
                .thenReturn(new Session("session-9", "user-1",
                        java.time.LocalDateTime.now().plusDays(30), "new-grant"));

        var response = service.refresh(new RefreshTokenRequest("old-grant"));

        assertThat(response.refreshToken()).isEqualTo("new-grant");
        assertThat(response.accessToken()).isNotBlank();
        verify(sessions).rotate(any(), any());
    }

    @Test
    void refreshDeniesSuspendedOwner() {
        Session presented = new Session("session-1", "user-1",
                java.time.LocalDateTime.now().plusDays(1), "old-grant");
        when(sessions.findValid("old-grant")).thenReturn(Optional.of(presented));
        when(users.findById("user-1")).thenReturn(Optional.of(
                persistedUser("user-1", UserRole.USER, UserStatus.SUSPENDED, "password123")));

        assertThatThrownBy(() -> service.refresh(new RefreshTokenRequest("old-grant")))
                .isInstanceOf(BadCredentialsException.class);

        verify(sessions, never()).rotate(any(), any());
    }

    @Test
    void refreshDeniesUnknownGrant() {
        when(sessions.findValid("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.refresh(new RefreshTokenRequest("ghost")))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void signOutRevokesOnlyThePresentedGrant() {
        User user = persistedUser("user-1", UserRole.USER, UserStatus.ACTIVE, "password123");
        var response = service.signOut(new AuthUser(user), "session-1");

        assertThat(response.success()).isTrue();
        verify(sessions).revoke("session-1", "user-1");
    }

    @Test
    void signOutWithoutSessionClaimIsAcknowledged() {
        User user = persistedUser("user-1", UserRole.USER, UserStatus.ACTIVE, "password123");
        assertThat(service.signOut(new AuthUser(user), null).success()).isTrue();
        verify(sessions, never()).revoke(any(), any());
    }

    @Test
    void changePasswordVerifiesCurrentAndClearsForcedFlag() {
        User user = persistedUser("user-1", UserRole.USER, UserStatus.ACTIVE, "old-password");
        user.setMustChangePassword(true);
        when(users.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var response = service.changePassword(new AuthUser(user),
                new ChangePasswordRequest("old-password", "new-password-9"));

        assertThat(response.success()).isTrue();
        assertThat(user.isMustChangePassword()).isFalse();
        assertThat(passwordEncoder.matches("new-password-9", user.getPasswordHash())).isTrue();
        verify(sessions).revokeAllForUser("user-1");
        verify(audit).persist(auditCaptor.capture());
        assertThat(auditCaptor.getValue().action()).isEqualTo("user.password_changed");
    }

    @Test
    void changePasswordRejectsWrongCurrentCredential() {
        User user = persistedUser("user-1", UserRole.USER, UserStatus.ACTIVE, "old-password");

        assertThatThrownBy(() -> service.changePassword(new AuthUser(user),
                new ChangePasswordRequest("wrong-password", "new-password-9")))
                .isInstanceOf(BadCredentialsException.class);

        verify(sessions, never()).revokeAllForUser(any());
    }
}
