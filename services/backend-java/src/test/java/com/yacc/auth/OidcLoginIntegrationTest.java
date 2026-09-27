package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.net.URI;
import java.util.Map;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.event.InteractiveAuthenticationSuccessEvent;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.AccountRepository;
import com.yacc.auth.repository.UserRepository;
import com.yacc.auth.service.AuthEmailSender;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * MIG-032 OIDC relying-party integration tests (AC-MIG-032-1): the full
 * {@code oauth2Login} authorization-code dance against an in-process stub
 * IdP ({@link StubOidcProvider}) through the real Spring Security filter
 * chain and the real PostgreSQL data layer — authorization redirect,
 * code+nonce exchange, ID-token validation, explicit account linking,
 * provisioning, status enforcement, and the RBAC interaction of the issued
 * session.
 *
 * <p>Rollback isolation: the shared Testcontainers database persists the
 * idempotent bootstrap identity; every other row this test creates is rolled
 * back per test method. The MIG-031 auth-email transport is mocked — no
 * external provider is ever contacted; the IdP stub runs on loopback.</p>
 */
@AutoConfigureMockMvc
@Transactional
@RecordApplicationEvents
class OidcLoginIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String REGISTRATION_ID = "fixture-idp";
    private static final String TEST_PASSWORD = "test-password-123";

    private static final StubOidcProvider STUB_IDP = new StubOidcProvider();

    @DynamicPropertySource
    static void oidcRegistration(DynamicPropertyRegistry registry) {
        registry.add("yacc.auth.oauth2.enabled", () -> "true");
        String prefix = "yacc.auth.oauth2.registrations." + REGISTRATION_ID;
        registry.add(prefix + ".client-id", StubOidcProvider.CLIENT_ID::toString);
        registry.add(prefix + ".client-secret", () -> "test-client-secret");
        registry.add(prefix + ".issuer-uri", STUB_IDP::issuer);
        registry.add(prefix + ".authorization-uri", () -> STUB_IDP.issuer() + "/authorize");
        registry.add(prefix + ".token-uri", () -> STUB_IDP.issuer() + "/token");
        registry.add(prefix + ".jwk-set-uri", () -> STUB_IDP.issuer() + "/jwks");
    }

    @MockitoBean
    private AuthEmailSender authEmailSender;

    private final MockMvc mockMvc;

    private final UserRepository users;

    private final AccountRepository accounts;

    private final ClientRegistrationRepository clientRegistrations;

    private final ObjectMapper mapper;

    @Autowired
    OidcLoginIntegrationTest(MockMvc mockMvc, UserRepository users, AccountRepository accounts,
            ClientRegistrationRepository clientRegistrations, ObjectMapper mapper) {
        this.mockMvc = mockMvc;
        this.users = users;
        this.accounts = accounts;
        this.clientRegistrations = clientRegistrations;
        this.mapper = mapper;
    }

    private void seedUser(String id, String email, UserRole role, UserStatus status) {
        users.save(new User(id, email, "Fixture " + role.getLabel(),
                new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
                        .encode(TEST_PASSWORD),
                role, status, true));
    }

    /** The authorization step: entry redirect, then a code minted for its nonce. */
    private MintedSession beginLogin(String subject, String email, boolean emailVerified)
            throws Exception {
        MintedAuthorization authorization = beginAuthorization();
        String code = STUB_IDP.mint(subject, email, emailVerified, authorization.nonce());
        return new MintedSession(authorization.session(), authorization.state(), code);
    }

    /** The authorization step only: entry redirect capturing session, state, nonce. */
    private MintedAuthorization beginAuthorization() throws Exception {
        MvcResult entry = mockMvc
                .perform(get("/api/auth/oidc/authorization/{id}", REGISTRATION_ID))
                .andExpect(status().is3xxRedirection())
                .andReturn();
        String location = entry.getResponse().getRedirectedUrl();
        assertThat(location).startsWith(STUB_IDP.issuer() + "/authorize?");
        MockHttpSession session = (MockHttpSession) entry.getRequest().getSession(false);
        Map<String, String> query = queryParams(location);
        return new MintedAuthorization(session, query.get("state"), query.get("nonce"));
    }

    private record MintedAuthorization(MockHttpSession session, String state, String nonce) {
    }

    private record MintedSession(MockHttpSession session, String state, String code) {
    }

    private JsonNode completeLogin(MintedSession login) throws Exception {
        MvcResult callback = mockMvc
                .perform(get("/api/auth/oidc/callback/{id}", REGISTRATION_ID)
                        .session(login.session())
                        .param("code", login.code())
                        .param("state", login.state()))
                .andExpect(status().isOk())
                .andReturn();
        return mapper.readTree(callback.getResponse().getContentAsString());
    }

    /** Completes the dance expecting the identity to be denied with 401. */
    private void completeLoginExpectingDenial(MintedSession login) throws Exception {
        mockMvc.perform(get("/api/auth/oidc/callback/{id}", REGISTRATION_ID)
                        .session(login.session())
                        .param("code", login.code())
                        .param("state", login.state()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Authentication required"));
    }

    /**
     * Negative-dance closure (Review Loop 1, finding 2): the tampered dance is
     * denied, and nothing moved — no {@code account} link row, no provisioned
     * identity (bootstrap user only), no success audit event.
     */
    private void assertNoProvisioningLinkingOrSuccessAudit(String subject,
            org.springframework.test.context.event.ApplicationEvents events) {
        assertThat(accounts.findByProviderIdAndAccountId(REGISTRATION_ID, subject)).isEmpty();
        assertThat(users.count()).isOne();
        assertThat(events.stream(InteractiveAuthenticationSuccessEvent.class).count()).isZero();
    }

    private static Map<String, String> queryParams(String location) {
        String query = URI.create(location).getQuery();
        return java.util.Arrays.stream(query.split("&"))
                .map(pair -> pair.split("=", 2))
                .collect(Collectors.toMap(pair -> pair[0],
                        pair -> java.net.URLDecoder.decode(pair[1],
                                java.nio.charset.StandardCharsets.UTF_8)));
    }

    @Test
    void registrationIsBuiltFromConfiguration() {
        ClientRegistration registration = clientRegistrations.findByRegistrationId(REGISTRATION_ID);
        assertThat(registration).isNotNull();
        assertThat(registration.getClientId()).isEqualTo(StubOidcProvider.CLIENT_ID);
        assertThat(registration.getProviderDetails().getAuthorizationUri())
                .isEqualTo(STUB_IDP.issuer() + "/authorize");
        assertThat(registration.getProviderDetails().getTokenUri())
                .isEqualTo(STUB_IDP.issuer() + "/token");
        assertThat(registration.getProviderDetails().getJwkSetUri())
                .isEqualTo(STUB_IDP.issuer() + "/jwks");
        assertThat(registration.getRedirectUri())
                .isEqualTo("{baseUrl}/api/auth/oidc/callback/{registrationId}");
        assertThat(registration.getScopes()).contains("openid", "profile", "email");
    }

    @Test
    void oidcLoginProvisionsNewUserEndToEndAndIssuesTheSessionContract(
            org.springframework.test.context.event.ApplicationEvents events) throws Exception {
        JsonNode session = completeLogin(
                beginLogin("sub-newcomer", "newcomer@fixture.yacc.local", true));

        // Canonical session contract (same shape as local sign-in).
        assertThat(session.get("user").get("id").asText()).isNotEmpty();
        assertThat(session.get("user").get("email").asText())
                .isEqualTo("newcomer@fixture.yacc.local");
        assertThat(session.get("user").get("role").asText()).isEqualTo("user");
        assertThat(session.get("user").get("status").asText()).isEqualTo("active");
        assertThat(session.get("accessToken").asText()).isNotEmpty();
        assertThat(session.get("refreshToken").asText()).isNotEmpty();

        String userId = session.get("user").get("id").asText();
        String accessToken = session.get("accessToken").asText();

        // The issued access token resolves the identity on protected paths.
        mockMvc.perform(get("/api/auth/get-session").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("newcomer@fixture.yacc.local"));

        // RBAC interaction: the provisioned identity is USER and nothing more.
        mockMvc.perform(get("/api/test/rbac/user").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/test/rbac/manager").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/test/rbac/super-admin").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isForbidden());

        // The explicit link row exists and points at the provisioned identity.
        assertThat(accounts.findByProviderIdAndAccountId(REGISTRATION_ID, "sub-newcomer"))
                .hasValueSatisfying(link -> assertThat(link.getUserId()).isEqualTo(userId));

        // Exactly one interactive login success event (audit parity: one
        // user.login record per RP sign-in).
        assertThat(events.stream(InteractiveAuthenticationSuccessEvent.class).count()).isEqualTo(1);

    }

    @Test
    void oidcLoginReusesTheExplicitLinkInsteadOfReprovisioning() throws Exception {
        JsonNode first = completeLogin(beginLogin("sub-repeat", "repeat@fixture.yacc.local", true));
        JsonNode second = completeLogin(beginLogin("sub-repeat", "repeat@fixture.yacc.local", true));

        assertThat(second.get("user").get("id").asText())
                .isEqualTo(first.get("user").get("id").asText());
        // Bootstrap identity + one provisioned user — no reprovisioning.
        assertThat(users.count()).isEqualTo(2);
    }

    @Test
    void oidcLoginLinksAnExistingVerifiedEmailMatchWithoutChangingRole() throws Exception {
        seedUser("00000000-0000-0000-0000-000000001a1", "manager@fixture.yacc.local",
                UserRole.MANAGER, UserStatus.ACTIVE);

        JsonNode session = completeLogin(
                beginLogin("sub-manager", "manager@fixture.yacc.local", true));

        // The local identity keeps its role; no new user row was created.
        assertThat(session.get("user").get("id").asText())
                .isEqualTo("00000000-0000-0000-0000-000000001a1");
        assertThat(session.get("user").get("role").asText()).isEqualTo("manager");

        // RBAC interaction through the RP-issued access token.
        String accessToken = session.get("accessToken").asText();
        mockMvc.perform(get("/api/test/rbac/manager").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/test/rbac/super-admin").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isForbidden());

        assertThat(accounts.findByProviderIdAndAccountId(REGISTRATION_ID, "sub-manager"))
                .hasValueSatisfying(
                        link -> assertThat(link.getUserId())
                                .isEqualTo("00000000-0000-0000-0000-000000001a1"));

        // Local sign-in remains possible for the linked identity (the RP does
        // not disturb the MIG-030 local auth surface).
        mockMvc.perform(post("/api/auth/sign-in/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("email", "manager@fixture.yacc.local")
                                .put("password", TEST_PASSWORD).toString()))
                .andExpect(status().isOk());
    }

    @Test
    void oidcLoginDeniesAnInactiveLinkedIdentity() throws Exception {
        JsonNode first = completeLogin(beginLogin("sub-inactive", "gone@fixture.yacc.local", true));
        assertThat(first.get("user").get("status").asText()).isEqualTo("active");

        User user = users.findById(first.get("user").get("id").asText()).orElseThrow();
        user.setStatus(UserStatus.INACTIVE);
        users.save(user);

        // Status enforcement on the RP entry point: the linked identity can
        // no longer sign in through the IdP (valid code, denied identity).
        completeLoginExpectingDenial(
                beginLogin("sub-inactive", "gone@fixture.yacc.local", true));
    }

    @Test
    void oidcLoginDeniesAnUnverifiedEmailWithoutAnExistingLink() throws Exception {
        completeLoginExpectingDenial(
                beginLogin("sub-unverified", "unverified@fixture.yacc.local", false));

        // Nothing was provisioned or linked for the denied identity.
        assertThat(accounts.findByProviderIdAndAccountId(REGISTRATION_ID, "sub-unverified"))
                .isEmpty();
    }

    @Test
    void oidcLoginDeniesASuspendedEmailMatchWithoutLinkingIt() throws Exception {
        seedUser("00000000-0000-0000-0000-000000001b2", "suspended@fixture.yacc.local",
                UserRole.USER, UserStatus.SUSPENDED);

        completeLoginExpectingDenial(
                beginLogin("sub-suspended", "suspended@fixture.yacc.local", true));

        // Fail-closed before linking: the non-active account gains no link.
        assertThat(accounts.findByProviderIdAndAccountId(REGISTRATION_ID, "sub-suspended"))
                .isEmpty();
    }

    @Test
    void oidcLoginDeniesAMismatchedStateWithoutProvisioningLinkingOrSuccessAudit(
            org.springframework.test.context.event.ApplicationEvents events) throws Exception {
        // Review Loop 1, finding 2 (state): the callback state must match the
        // authorization request's saved state — replay/forgery denied.
        MintedAuthorization authorization = beginAuthorization();
        String code = STUB_IDP.mint("sub-evil-state", "state@fixture.yacc.local", true,
                authorization.nonce());

        completeLoginExpectingDenial(
                new MintedSession(authorization.session(), "attacker-forged-state", code));

        assertNoProvisioningLinkingOrSuccessAudit("sub-evil-state", events);
    }

    @Test
    void oidcLoginDeniesAMismatchedNonceWithoutProvisioningLinkingOrSuccessAudit(
            org.springframework.test.context.event.ApplicationEvents events) throws Exception {
        // Review Loop 1, finding 2 (nonce): the ID token must bind the nonce
        // of this authorization request — a token minted for another nonce
        // (replay/injection) is denied after a valid code exchange.
        MintedAuthorization authorization = beginAuthorization();
        String code = STUB_IDP.mintWith("sub-evil-nonce", "nonce@fixture.yacc.local", true,
                "attacker-chosen-nonce", null, null, false);

        completeLoginExpectingDenial(
                new MintedSession(authorization.session(), authorization.state(), code));

        assertNoProvisioningLinkingOrSuccessAudit("sub-evil-nonce", events);
    }

    @Test
    void oidcLoginDeniesAForeignIssuerWithoutProvisioningLinkingOrSuccessAudit(
            org.springframework.test.context.event.ApplicationEvents events) throws Exception {
        // Review Loop 1, finding 2 (issuer): a correctly signed (JWKS) token
        // carrying a foreign `iss` must be denied — the attack surface that
        // making issuer-uri mandatory fail-closed removes.
        MintedAuthorization authorization = beginAuthorization();
        String code = STUB_IDP.mintWith("sub-evil-issuer", "issuer@fixture.yacc.local", true,
                authorization.nonce(), "https://evil.fixture", null, false);

        completeLoginExpectingDenial(
                new MintedSession(authorization.session(), authorization.state(), code));

        assertNoProvisioningLinkingOrSuccessAudit("sub-evil-issuer", events);
    }

    @Test
    void oidcLoginDeniesAWrongAudienceWithoutProvisioningLinkingOrSuccessAudit(
            org.springframework.test.context.event.ApplicationEvents events) throws Exception {
        // Review Loop 1, finding 2 (audience): an ID token minted for another
        // client is denied even when correctly signed by the trusted key.
        MintedAuthorization authorization = beginAuthorization();
        String code = STUB_IDP.mintWith("sub-evil-audience", "aud@fixture.yacc.local", true,
                authorization.nonce(), null, "another-client", false);

        completeLoginExpectingDenial(
                new MintedSession(authorization.session(), authorization.state(), code));

        assertNoProvisioningLinkingOrSuccessAudit("sub-evil-audience", events);
    }

    @Test
    void oidcLoginDeniesAnIdTokenSignedOutsideTheJwksWithoutProvisioningLinkingOrSuccessAudit(
            org.springframework.test.context.event.ApplicationEvents events) throws Exception {
        // Review Loop 1, finding 2 (signature/JWKS): a token signed by a key
        // never published in the IdP's JWKS is denied.
        MintedAuthorization authorization = beginAuthorization();
        String code = STUB_IDP.mintWith("sub-evil-signature", "signature@fixture.yacc.local",
                true, authorization.nonce(), null, null, true);

        completeLoginExpectingDenial(
                new MintedSession(authorization.session(), authorization.state(), code));

        assertNoProvisioningLinkingOrSuccessAudit("sub-evil-signature", events);
    }

    @Test
    void unknownRegistrationIdIsDenied() throws Exception {
        // Spring Security's default deny for an unresolvable registration id:
        // the redirect filter fails the request outright (500) instead of
        // starting a login. The public surface only links config-owned
        // registration ids, so a malformed id is rejected, never trusted.
        mockMvc.perform(get("/api/auth/oidc/authorization/{id}", "no-such-idp"))
                .andExpect(status().isInternalServerError());
    }

    @Test
    void tokenlessApiRequestsKeepTheFrozen401ContractWhileTheRpIsEnabled() throws Exception {
        mockMvc.perform(get("/api/auth/get-session"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Authentication required"));
    }
}
