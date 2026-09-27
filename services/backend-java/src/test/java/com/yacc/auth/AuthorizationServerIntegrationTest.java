package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * MIG-033 embedded OIDC authorization-server integration tests (AC
 * MIG-033-1..3; ADR-025 AS role): discovery, JWKS, the full
 * authorization-code + PKCE + consent + refresh + revocation lifecycle
 * through the real filter chains and the real PostgreSQL data layer, the
 * MIG-030 compatibility of AS-issued tokens (resource-server seam + JWT
 * contract), and the fail-closed denials (suspended identity, missing PKCE,
 * unauthenticated surface, unregistered grant).
 *
 * <p>Dual-role OIDC evidence: this class exercises the AS role against the
 * real server (the ID token is verified exactly as an OIDC relying party
 * would — discovery metadata + JWKS signature + issuer/audience/timestamp/
 * nonce validation), while the RP role remains covered by
 * {@code OidcLoginIntegrationTest} (MIG-032). Every AS test seeds its own
 * identity, so the in-memory consent state can never bleed between tests.</p>
 */
@AutoConfigureMockMvc
@Transactional
class AuthorizationServerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String CLIENT_ID = "yacc-frontend";
    private static final String REDIRECT_URI = "http://localhost:5173/auth/callback";
    private static final String ISSUER = "http://localhost:8080";
    private static final String TEST_PASSWORD = "test-password-123";

    private final MockMvc mockMvc;

    private final UserRepository users;

    private final ObjectMapper mapper;

    @Autowired
    AuthorizationServerIntegrationTest(MockMvc mockMvc, UserRepository users,
            ObjectMapper mapper) {
        this.mockMvc = mockMvc;
        this.users = users;
        this.mapper = mapper;
    }

    private void seedUser(String id, String email, UserRole role, UserStatus status) {
        users.save(new User(id, email, "Fixture " + role.getLabel(),
                new BCryptPasswordEncoder().encode(TEST_PASSWORD),
                role, status, true));
    }

    /** Signs in through the MIG-030 local-auth surface for a fresh Bearer. */
    private String signIn(String email) throws Exception {
        MvcResult result = mockMvc
                .perform(post("/api/auth/sign-in/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("email", email)
                                .put("password", TEST_PASSWORD).toString()))
                .andExpect(status().isOk())
                .andReturn();
        return mapper.readTree(result.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    private record Pkce(String verifier, String challenge) {

        static Pkce generate() {
            try {
                String verifier = Base64.getUrlEncoder().withoutPadding()
                        .encodeToString(java.security.SecureRandom.getInstanceStrong()
                                .generateSeed(32));
                byte[] digest = MessageDigest.getInstance("SHA-256")
                        .digest(verifier.getBytes(StandardCharsets.US_ASCII));
                String challenge = Base64.getUrlEncoder().withoutPadding()
                        .encodeToString(digest);
                return new Pkce(verifier, challenge);
            } catch (java.security.GeneralSecurityException e) {
                throw new IllegalStateException(e);
            }
        }
    }

    /**
     * The authorization step: a Bearer-authenticated resource owner (the
     * MIG-030 seam) requests an authorization code — consent is required, so
     * the answer redirects to the framework consent endpoint. The parameters
     * ride the query string: the framework authorization-request converter
     * reads only parameters present in the raw query string (mock servlet
     * nuance — {@code .param()} alone does not build one).
     */
    private MvcResult performAuthorize(String bearerToken, Pkce pkce, String state,
            String nonce, String scope) throws Exception {
        // Parameter values ride the query string unencoded: the mock servlet
        // does not URL-decode query values, so the AS would otherwise see the
        // percent-encoded form of the redirect URI (rejected by the
        // registered-redirect match).
        String query = "response_type=code"
                + "&client_id=" + CLIENT_ID
                + "&scope=" + scope
                + "&state=" + state
                + (nonce == null ? "" : "&nonce=" + nonce)
                + "&redirect_uri=" + REDIRECT_URI
                + (pkce == null ? "" : "&code_challenge=" + pkce.challenge())
                + (pkce == null ? "" : "&code_challenge_method=S256");
        return mockMvc
                .perform(get("/oauth2/authorize?" + query)
                        .header("Authorization", "Bearer " + bearerToken))
                .andReturn();
    }

    /**
     * The authorization step: a Bearer-authenticated resource owner (the
     * MIG-030 seam) requests an authorization code — consent is required, so
     * the framework answers with its default consent page (200 HTML), whose
     * form carries a fresh consent state and the consentable scopes.
     */
    private ConsentStep authorizeExpectingConsent(String bearerToken, Pkce pkce,
            String state, String nonce) throws Exception {
        MvcResult result = performAuthorize(bearerToken, pkce, state, nonce,
                "openid profile email");
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("Consent required");
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("name=\"state\" value=\"([^\"]+)\"")
                .matcher(body);
        assertThat(matcher.find()).isTrue();
        return new ConsentStep(matcher.group(1), nonce, pkce);
    }

    private record ConsentStep(String consentState, String nonce, Pkce pkce) {
    }

    /**
     * Submits the consent form (framework default: POST back to the
     * authorization endpoint; {@code openid} is granted implicitly, the
     * checkboxes approve {@code profile} and {@code email}) and captures the
     * authorization code from the redirect.
     */
    private String approveConsent(String bearerToken, ConsentStep step) throws Exception {
        MvcResult result = mockMvc
                .perform(post("/oauth2/authorize")
                        .header("Authorization", "Bearer " + bearerToken)
                        .param("client_id", CLIENT_ID)
                        .param("state", step.consentState())
                        .param("scope", "openid")
                        .param("scope", "profile")
                        .param("scope", "email"))
                .andExpect(status().is3xxRedirection())
                .andReturn();
        String location = result.getResponse().getRedirectedUrl();
        assertThat(location).startsWith(REDIRECT_URI);
        Map<String, String> query = queryParams(location);
        return query.get("code");
    }

    /** The authorization-code + PKCE exchange at the token endpoint. */
    private JsonNode exchangeCode(String code, Pkce pkce) throws Exception {
        MvcResult result = mockMvc
                .perform(post("/oauth2/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "authorization_code")
                        .param("code", code)
                        .param("redirect_uri", REDIRECT_URI)
                        .param("client_id", CLIENT_ID)
                        .param("code_verifier", pkce.verifier()))
                .andExpect(status().isOk())
                .andReturn();
        return mapper.readTree(result.getResponse().getContentAsString());
    }

    private static Map<String, String> queryParams(String location) {
        String query = java.net.URI.create(location).getQuery();
        return java.util.Arrays.stream(query.split("&"))
                .map(pair -> pair.split("=", 2))
                .collect(java.util.stream.Collectors.toMap(
                        pair -> pair[0],
                        pair -> pair.length == 2 ? pair[1] : ""));
    }

    /**
     * The relying-party-side verification machinery: discovery metadata,
     * JWKS-fetched signature key, issuer/timestamp validation — the checks
     * an OIDC RP performs on the AS-issued ID token.
     */
    private JwtDecoder relyingPartyIdTokenDecoder() throws Exception {
        MvcResult discovery = mockMvc
                .perform(get("/.well-known/openid-configuration"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode metadata = mapper.readTree(
                discovery.getResponse().getContentAsString());
        assertThat(metadata.get("issuer").asText()).isEqualTo(ISSUER);
        assertThat(metadata.get("jwks_uri").asText()).isEqualTo(ISSUER + "/oauth2/jwks");
        assertThat(metadata.get("authorization_endpoint").asText())
                .isEqualTo(ISSUER + "/oauth2/authorize");
        assertThat(metadata.get("token_endpoint").asText())
                .isEqualTo(ISSUER + "/oauth2/token");
        assertThat(metadata.get("userinfo_endpoint").asText())
                .isEqualTo(ISSUER + "/userinfo");
        assertThat(metadata.get("revocation_endpoint").asText())
                .isEqualTo(ISSUER + "/oauth2/revoke");

        MvcResult jwks = mockMvc
                .perform(get(metadata.get("jwks_uri").asText().replace(ISSUER, "")))
                .andExpect(status().isOk())
                .andReturn();
        RSAKey signingKey = (RSAKey) JWKSet.parse(
                jwks.getResponse().getContentAsString()).getKeys().get(0);

        NimbusJwtDecoder decoder = NimbusJwtDecoder
                .withPublicKey(signingKey.toRSAPublicKey()).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(java.time.Duration.ZERO),
                new JwtIssuerValidator(ISSUER)));
        return decoder;
    }

    @Test
    void discoveryAndJwksArePubliclyAccessible() throws Exception {
        mockMvc.perform(get("/.well-known/openid-configuration"))
                .andExpect(status().isOk());
        MvcResult jwks = mockMvc.perform(get("/oauth2/jwks"))
                .andExpect(status().isOk())
                .andReturn();
        JWKSet served = JWKSet.parse(jwks.getResponse().getContentAsString());
        // The JWKS serves the shared signing key — one signing-key source
        // (the same key material the resource server verifies with).
        assertThat(served.getKeys()).hasSize(1);
        assertThat(served.getKeys().get(0).getKeyID())
                .isEqualTo("yacc-access-token");
    }

    @Test
    void authorizationCodeFlowWithConsentAndPkceIssuesCompatibleTokens() throws Exception {
        seedUser("11111111-1111-1111-1111-111111111111", "as-flow@fixture.yacc.local",
                UserRole.MANAGER, UserStatus.ACTIVE);
        String bearer = signIn("as-flow@fixture.yacc.local");
        Pkce pkce = Pkce.generate();

        ConsentStep step = authorizeExpectingConsent(bearer, pkce, "state-flow-1", "nonce-flow-1");
        String code = approveConsent(bearer, step);
        JsonNode tokens = exchangeCode(code, pkce);

        assertThat(tokens.get("token_type").asText()).isEqualTo("Bearer");
        assertThat(tokens.get("access_token").asText()).isNotEmpty();
        assertThat(tokens.get("refresh_token").asText()).isNotEmpty();
        assertThat(tokens.get("id_token").asText()).isNotEmpty();
        assertThat(tokens.get("scope").asText()).contains("openid");

        // RP-machinery ID-token validation (signature via JWKS, issuer,
        // timestamps) + contract claims: sub = user id, aud = client id,
        // nonce binding, lowercase wire role.
        var idToken = relyingPartyIdTokenDecoder()
                .decode(tokens.get("id_token").asText());
        assertThat(idToken.getSubject())
                .isEqualTo("11111111-1111-1111-1111-111111111111");
        assertThat(idToken.getAudience()).containsExactly(CLIENT_ID);
        assertThat(idToken.getClaimAsString("nonce")).isEqualTo("nonce-flow-1");
        assertThat(idToken.getClaimAsString("role")).isEqualTo("manager");
        assertThat(idToken.getClaimAsString("email")).isEqualTo("as-flow@fixture.yacc.local");

        // MIG-030 JWT-contract compatibility: the AS access token verifies
        // through the SAME resource-server seam and resolves the identity.
        String asAccessToken = tokens.get("access_token").asText();
        mockMvc.perform(get("/api/auth/get-session")
                        .header("Authorization", "Bearer " + asAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id")
                        .value("11111111-1111-1111-1111-111111111111"))
                .andExpect(jsonPath("$.user.role").value("manager"));
    }

    @Test
    void consentIsRememberedForThePrincipalAndScopeSet() throws Exception {
        seedUser("22222222-2222-2222-2222-222222222222", "consent@fixture.yacc.local",
                UserRole.USER, UserStatus.ACTIVE);
        String bearer = signIn("consent@fixture.yacc.local");
        Pkce pkce = Pkce.generate();

        // Complete one full consented dance so the consent is remembered.
        String firstCode = approveConsent(bearer,
                authorizeExpectingConsent(bearer, pkce, "state-consent-1", "nonce-consent-1"));
        exchangeCode(firstCode, pkce);

        // A second authorization for the same principal + scopes skips the
        // consent screen (the remembered consent) and issues the code.
        MvcResult second = performAuthorize(bearer, pkce, "state-consent-2", null,
                "openid profile email");
        assertThat(second.getResponse().getStatus()).isEqualTo(302);
        assertThat(second.getResponse().getRedirectedUrl())
                .startsWith(REDIRECT_URI)
                .contains("code=");
    }

    @Test
    void refreshGrantRotatesTokensAndTheRevokedGrantIsDenied() throws Exception {
        seedUser("33333333-3333-3333-3333-333333333333", "refresh@fixture.yacc.local",
                UserRole.USER, UserStatus.ACTIVE);
        String bearer = signIn("refresh@fixture.yacc.local");
        Pkce pkce = Pkce.generate();
        String code = approveConsent(bearer,
                authorizeExpectingConsent(bearer, pkce, "state-refresh-1", "nonce-refresh-1"));
        JsonNode tokens = exchangeCode(code, pkce);
        String refreshToken = tokens.get("refresh_token").asText();

        // Refresh: new tokens; the presented grant is rotated out (MIG-030
        // SessionService.rotate parity — reuseRefreshTokens=false).
        MvcResult refreshed = mockMvc
                .perform(post("/oauth2/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "refresh_token")
                        .param("refresh_token", refreshToken)
                        .param("client_id", CLIENT_ID))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode rotated = mapper.readTree(refreshed.getResponse().getContentAsString());
        assertThat(rotated.get("refresh_token").asText()).isNotEqualTo(refreshToken);

        // The rotated-out grant is single-use.
        mockMvc.perform(post("/oauth2/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "refresh_token")
                        .param("refresh_token", refreshToken)
                        .param("client_id", CLIENT_ID)
                        .param("code_verifier", pkce.verifier()))
                .andExpect(status().isBadRequest());

        // Revocation lifecycle: revoke the current grant, then the refresh
        // dance is dead (the durable MIG-030 session rows are untouched).
        String liveGrant = rotated.get("refresh_token").asText();
        mockMvc.perform(post("/oauth2/revoke")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("token", liveGrant)
                        .param("client_id", CLIENT_ID))
                .andExpect(status().isOk());
        mockMvc.perform(post("/oauth2/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "refresh_token")
                        .param("refresh_token", liveGrant)
                        .param("client_id", CLIENT_ID)
                        .param("code_verifier", pkce.verifier()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void userInfoServesScopeFilteredClaimsFromTheGrantedIdentity() throws Exception {
        seedUser("44444444-4444-4444-4444-444444444444", "userinfo@fixture.yacc.local",
                UserRole.SUPER_ADMIN, UserStatus.ACTIVE);
        String bearer = signIn("userinfo@fixture.yacc.local");
        Pkce pkce = Pkce.generate();
        String code = approveConsent(bearer,
                authorizeExpectingConsent(bearer, pkce, "state-userinfo-1", "nonce-ui-1"));
        JsonNode tokens = exchangeCode(code, pkce);

        mockMvc.perform(get("/userinfo")
                        .header("Authorization",
                                "Bearer " + tokens.get("access_token").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sub")
                        .value("44444444-4444-4444-4444-444444444444"))
                .andExpect(jsonPath("$.email").value("userinfo@fixture.yacc.local"))
                .andExpect(jsonPath("$.email_verified").value(true))
                .andExpect(jsonPath("$.role").value("super_admin"));
    }

    @Test
    void suspendedIdentityIsDeniedAtTheAuthorizationEndpoint() throws Exception {
        seedUser("55555555-5555-5555-5555-555555555555", "suspend@fixture.yacc.local",
                UserRole.USER, UserStatus.ACTIVE);
        String bearer = signIn("suspend@fixture.yacc.local");

        User user = users.findById("55555555-5555-5555-5555-555555555555").orElseThrow();
        user.setStatus(UserStatus.SUSPENDED);
        users.save(user);

        // Fail-closed at the AS: the same status enforcement that protects
        // every /api path denies the suspended identity before any code is
        // minted (ADR-025 — denied at BOTH roles).
        mockMvc.perform(get("/oauth2/authorize?"
                        + "response_type=code&client_id=" + CLIENT_ID
                        + "&scope=openid&state=state-suspended"
                        + "&redirect_uri=" + REDIRECT_URI
                        + "&code_challenge=" + Pkce.generate().challenge()
                        + "&code_challenge_method=S256")
                        .header("Authorization", "Bearer " + bearer))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Authentication required"));
    }

    @Test
    void authorizationEndpointIsDeniedWithoutAToken() throws Exception {
        // The frozen 401 JSON contract holds on the AS chain for a fully
        // valid authorization request presented without a resource-owner
        // token — no login-page redirect for API clients.
        MvcResult result = mockMvc
                .perform(get("/oauth2/authorize?"
                                + "response_type=code&client_id=" + CLIENT_ID
                                + "&scope=openid&state=state-anon"
                                + "&redirect_uri=" + REDIRECT_URI
                                + "&code_challenge=" + Pkce.generate().challenge()
                                + "&code_challenge_method=S256"))
                .andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(401);
        assertThat(result.getResponse().getContentAsString()).contains("Authentication required");
        // The token endpoint keeps the frozen centralized 401 JSON body.
        mockMvc.perform(post("/oauth2/token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Authentication required"));
    }

    @Test
    void missingPkceChallengeIsDeniedForThePublicClient() throws Exception {
        seedUser("66666666-6666-6666-6666-666666666666", "pkce@fixture.yacc.local",
                UserRole.USER, UserStatus.ACTIVE);
        String bearer = signIn("pkce@fixture.yacc.local");

        MvcResult result = mockMvc
                .perform(get("/oauth2/authorize?"
                                + "response_type=code&client_id=" + CLIENT_ID
                                + "&scope=openid&state=state-pkce"
                                + "&redirect_uri=" + java.net.URLEncoder.encode(
                                        REDIRECT_URI, StandardCharsets.UTF_8))
                        .header("Authorization", "Bearer " + bearer))
                .andReturn();
        // The public client requires PKCE — the AS denies the request.
        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat(result.getResponse().getErrorMessage()).contains("invalid_request");
    }

    @Test
    void wrongPkceVerifierIsDeniedAtTheTokenEndpoint() throws Exception {
        seedUser("77777777-7777-7777-7777-777777777777", "verifier@fixture.yacc.local",
                UserRole.USER, UserStatus.ACTIVE);
        String bearer = signIn("verifier@fixture.yacc.local");
        Pkce pkce = Pkce.generate();
        String code = approveConsent(bearer,
                authorizeExpectingConsent(bearer, pkce, "state-verifier-1", "nonce-vf-1"));

        mockMvc.perform(post("/oauth2/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "authorization_code")
                        .param("code", code)
                        .param("redirect_uri", REDIRECT_URI)
                        .param("client_id", CLIENT_ID)
                        .param("code_verifier", "wrong-verifier-wrong-verifier-wrong-verifier"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void clientCredentialsGrantIsNotRegistered() throws Exception {
        // Founder-fixed KISS: no machine client is named, so the grant
        // cannot be exercised by the (only) registered client.
        mockMvc.perform(post("/oauth2/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "client_credentials")
                        .param("client_id", CLIENT_ID))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unknownClientIsDeniedAtTheTokenEndpoint() throws Exception {
        mockMvc.perform(post("/oauth2/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .param("grant_type", "authorization_code")
                        .param("code", "any-code")
                        .param("redirect_uri", REDIRECT_URI)
                        .param("client_id", "not-registered")
                        .param("code_verifier", "verifier"))
                .andExpect(status().isUnauthorized());
    }

}
