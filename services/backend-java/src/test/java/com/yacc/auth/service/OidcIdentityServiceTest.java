package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.model.Account;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.AccountRepository;
import com.yacc.auth.repository.UserRepository;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Unit tests for the MIG-032 explicit-linking rule set
 * ({@link OidcIdentityService}): link hit, e-mail match, provisioning,
 * status enforcement, and fail-closed denials — with the repositories and
 * audit hook mocked (no Spring context, no network).
 */
class OidcIdentityServiceTest {

    private static final String PROVIDER = "fixture-idp";
    private static final String SUBJECT = "sub-123";
    private static final String EMAIL = "person@fixture.yacc.local";

    private UserRepository users;

    private AccountRepository accounts;

    private PasswordEncoder passwordEncoder;

    private AuditPersistence audit;

    private OidcIdentityService service;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        accounts = mock(AccountRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        audit = mock(AuditPersistence.class);
        when(passwordEncoder.encode(any())).thenReturn("unusable-hash");
        service = new OidcIdentityService(users, accounts, passwordEncoder, audit,
                new ObjectMapper());
    }

    private static OidcUser externalIdentity(String email, boolean emailVerified) {
        OidcIdToken idToken = new OidcIdToken("token-value", Instant.now(),
                Instant.now().plusSeconds(300),
                Map.of(IdTokenClaimNames.SUB, SUBJECT,
                        IdTokenClaimNames.ISS, "https://idp.fixture",
                        IdTokenClaimNames.AUD, "client",
                        IdTokenClaimNames.EXP, Instant.now().plusSeconds(300),
                        "email", email,
                        "email_verified", emailVerified));
        return new DefaultOidcUser(java.util.List.of(), idToken);
    }

    private User activeUser() {
        return new User("user-1", EMAIL, "Person", "existing-hash",
                UserRole.USER, UserStatus.ACTIVE, true);
    }

    @Test
    void resolvesAnExistingExplicitLinkWithoutCreatingANewOne() {
        User linked = activeUser();
        when(accounts.findByProviderIdAndAccountId(PROVIDER, SUBJECT))
                .thenReturn(Optional.of(new Account("account-1", "user-1", SUBJECT, PROVIDER)));
        when(users.findById("user-1")).thenReturn(Optional.of(linked));
        when(users.save(linked)).thenReturn(linked);

        User resolved = service.resolve(PROVIDER, externalIdentity(EMAIL, true));

        assertThat(resolved.getId()).isEqualTo("user-1");
        verify(accounts, never()).save(any(Account.class));
        verify(audit, never()).persist(any());
    }

    @Test
    void deniesAndAuditsABrokenLink() {
        when(accounts.findByProviderIdAndAccountId(PROVIDER, SUBJECT))
                .thenReturn(Optional.of(new Account("account-1", "deleted-user", SUBJECT, PROVIDER)));
        when(users.findById("deleted-user")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resolve(PROVIDER, externalIdentity(EMAIL, true)))
                .isInstanceOf(OAuth2AuthenticationException.class);
        verify(audit).persist(org.mockito.ArgumentMatchers.argThat(record ->
                record.action().equals("user.login.failed")));
    }

    @Test
    void linksAnExistingVerifiedEmailMatchExplicitly() {
        User existing = activeUser();
        when(accounts.findByProviderIdAndAccountId(PROVIDER, SUBJECT)).thenReturn(Optional.empty());
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(existing));
        when(users.save(existing)).thenReturn(existing);

        User resolved = service.resolve(PROVIDER, externalIdentity(EMAIL, true));

        assertThat(resolved.getId()).isEqualTo("user-1");
        verify(accounts).save(org.mockito.ArgumentMatchers.argThat(account ->
                account.getUserId().equals("user-1")
                        && account.getProviderId().equals(PROVIDER)
                        && account.getAccountId().equals(SUBJECT)));
        verify(audit).persist(org.mockito.ArgumentMatchers.argThat(record ->
                record.action().equals(OidcIdentityService.ACTION_OIDC_LINKED)
                        && record.entityId().equals("user-1")));
    }

    @Test
    void deniesASuspendedEmailMatchWithoutLinkingIt() {
        User suspended = activeUser();
        suspended.setStatus(UserStatus.SUSPENDED);
        when(accounts.findByProviderIdAndAccountId(PROVIDER, SUBJECT)).thenReturn(Optional.empty());
        when(users.findByEmail(EMAIL)).thenReturn(Optional.of(suspended));

        assertThatThrownBy(() -> service.resolve(PROVIDER, externalIdentity(EMAIL, true)))
                .isInstanceOf(OAuth2AuthenticationException.class);
        verify(accounts, never()).save(any(Account.class));
        verify(audit).persist(org.mockito.ArgumentMatchers.argThat(record ->
                record.action().equals("user.login.failed")));
    }

    @Test
    void deniesAnUnverifiedEmail() {
        when(accounts.findByProviderIdAndAccountId(PROVIDER, SUBJECT)).thenReturn(Optional.empty());

        assertThatThrownBy(
                () -> service.resolve(PROVIDER, externalIdentity(EMAIL, false)))
                .isInstanceOf(OAuth2AuthenticationException.class);
        verify(users, never()).save(any(User.class));
        verify(accounts, never()).save(any(Account.class));
    }

    @Test
    void deniesAMissingEmail() {
        when(accounts.findByProviderIdAndAccountId(PROVIDER, SUBJECT)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resolve(PROVIDER, externalIdentity("", false)))
                .isInstanceOf(OAuth2AuthenticationException.class);
        verify(users, never()).save(any(User.class));
    }

    @Test
    void provisionsANewUserRoleIdentityAndLinksIt() {
        when(accounts.findByProviderIdAndAccountId(PROVIDER, SUBJECT)).thenReturn(Optional.empty());
        when(users.findByEmail(EMAIL)).thenReturn(Optional.empty());
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        User provisioned = service.resolve(PROVIDER, externalIdentity(EMAIL, true));

        assertThat(provisioned.getRole()).isEqualTo(UserRole.USER);
        assertThat(provisioned.getStatus()).isEqualTo(UserStatus.ACTIVE);
        assertThat(provisioned.isEmailVerified()).isTrue();
        assertThat(provisioned.isMustChangePassword()).isFalse();
        assertThat(provisioned.getName()).isEqualTo(EMAIL);
        // Unusable local credential: bcrypt of a random value, never a blank
        // or guessable hash — local sign-in stays impossible.
        assertThat(provisioned.getPasswordHash()).isEqualTo("unusable-hash");
        verify(accounts).save(org.mockito.ArgumentMatchers.argThat(account ->
                account.getUserId().equals(provisioned.getId())));
        org.mockito.ArgumentCaptor<AuditRecord> auditCaptor =
                org.mockito.ArgumentCaptor.forClass(AuditRecord.class);
        verify(audit, org.mockito.Mockito.times(2)).persist(auditCaptor.capture());
        assertThat(auditCaptor.getAllValues().stream().map(AuditRecord::action))
                .containsExactly(OidcIdentityService.ACTION_OIDC_PROVISIONED,
                        OidcIdentityService.ACTION_OIDC_LINKED);
    }
}
