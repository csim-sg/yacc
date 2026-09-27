package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;
import com.yacc.auth.service.AuthEmailSender;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * MIG-030 wire-contract and security integration tests (AC-MIG-030-1..4):
 * local sign-in/sign-out, self-registration creating {@code user} only, the
 * RBAC 4-role matrix gates, status enforcement (inactive/suspended denied),
 * and the bootstrap forced-password-change flow — all through the real
 * Spring Security filter chain over the real PostgreSQL data layer.
 *
 * <p>Rollback isolation: the shared Testcontainers database persists the
 * idempotent bootstrap identity; every other row this test creates is rolled
 * back per test method. The MIG-031 auth-email transport is mocked — sign-up
 * issues the verification challenge, but no provider is ever contacted.</p>
 */
@AutoConfigureMockMvc
@Transactional
class AuthFlowIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String TEST_PASSWORD = "test-password-123";
    private static final String BOOTSTRAP_EMAIL = "bootstrap@fixture.yacc.local";
    private static final String BOOTSTRAP_INITIAL_CREDENTIAL = "bootstrap-initial-credential";

    @MockitoBean
    private AuthEmailSender authEmailSender;

    private final MockMvc mockMvc;

    private final UserRepository users;

    private final ObjectMapper mapper;

    /**
     * Constructor injection only (guardrails 004 §2; ADR-024; ADR-030):
     * the single {@code @Autowired}-annotated constructor — never field
     * injection.
     */
    @Autowired
    AuthFlowIntegrationTest(MockMvc mockMvc, UserRepository users, ObjectMapper mapper) {
        this.mockMvc = mockMvc;
        this.users = users;
        this.mapper = mapper;
    }

    private void seedUser(String id, String email, UserRole role, UserStatus status) {
        users.save(new User(id, email, "Fixture " + role.getLabel(),
                new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder()
                        .encode(TEST_PASSWORD),
                role, status, true));
    }

    private String signIn(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/sign-in/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("email", email)
                                .put("password", password).toString()))
                .andExpect(status().isOk())
                .andReturn();
        return mapper.readTree(result.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    @Test
    void signInReturnsCanonicalSessionContract() throws Exception {
        seedUser("00000000-0000-0000-0000-0000000000a1", "manager@fixture.yacc.local",
                UserRole.MANAGER, UserStatus.ACTIVE);

        mockMvc.perform(post("/api/auth/sign-in/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("email", "manager@fixture.yacc.local")
                                .put("password", TEST_PASSWORD).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").isNotEmpty())
                .andExpect(jsonPath("$.user.role").value("manager"))
                .andExpect(jsonPath("$.user.status").value("active"))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.mustChangePassword").value(false));
    }

    @Test
    void signInRejectsBadCredentialsAndNonActiveIdentitiesUniformly() throws Exception {
        seedUser("00000000-0000-0000-0000-0000000000b1", "suspended@fixture.yacc.local",
                UserRole.USER, UserStatus.SUSPENDED);

        // Unknown account, wrong password, and non-active identity all fail
        // identically with the frozen 401 {error} shape (anti-enumeration).
        mockMvc.perform(post("/api/auth/sign-in/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("email", "ghost@fixture.yacc.local")
                                .put("password", TEST_PASSWORD).toString()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid credentials"));

        mockMvc.perform(post("/api/auth/sign-in/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("email", "suspended@fixture.yacc.local")
                                .put("password", TEST_PASSWORD).toString()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Invalid credentials"));
    }

    @Test
    void signUpCreatesUserRoleOnlyAndIgnoresInjectedRole() throws Exception {
        // The body smuggles a "role" field — the request contract has no such
        // field; the created identity must still be role: user (AC-MIG-030-2).
        String body = "{\"email\":\"newcomer@fixture.yacc.local\","
                + "\"password\":\"password-123\",\"name\":\"Newcomer\","
                + "\"role\":\"super_admin\",\"status\":\"active\"}";

        mockMvc.perform(post("/api/auth/sign-up/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.role").value("user"))
                .andExpect(jsonPath("$.user.status").value("active"))
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty());

        // Persistence-level proof: the stored role is USER, not super_admin.
        User created = users.findByEmail("newcomer@fixture.yacc.local").orElseThrow();
        assertThat(created.getRole()).isEqualTo(UserRole.USER);
        assertThat(created.isMustChangePassword()).isFalse();

        // Duplicate registration fails generically (anti-enumeration 400).
        mockMvc.perform(post("/api/auth/sign-up/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation error"));
    }

    @Test
    void getSessionResolvesThePresentedAccessToken() throws Exception {
        String token = signIn(BOOTSTRAP_EMAIL, BOOTSTRAP_INITIAL_CREDENTIAL);

        mockMvc.perform(get("/api/auth/get-session").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value(BOOTSTRAP_EMAIL))
                .andExpect(jsonPath("$.user.role").value("super_admin"))
                .andExpect(jsonPath("$.mustChangePassword").value(true));
    }

    @Test
    void protectedSurfaceRequiresAToken() throws Exception {
        mockMvc.perform(get("/api/auth/get-session"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Authentication required"));
    }

    @Test
    void refreshRotatesTheGrantAndRetiresThePresentedOne() throws Exception {
        seedUser("00000000-0000-0000-0000-0000000000c1", "rotator@fixture.yacc.local",
                UserRole.USER, UserStatus.ACTIVE);
        MvcResult signIn = mockMvc.perform(post("/api/auth/sign-in/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("email", "rotator@fixture.yacc.local")
                                .put("password", TEST_PASSWORD).toString()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode session = mapper.readTree(signIn.getResponse().getContentAsString());

        MvcResult refresh = mockMvc.perform(post("/api/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("refreshToken", session.get("refreshToken").asText()).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn();
        String newGrant = mapper.readTree(refresh.getResponse().getContentAsString())
                .get("refreshToken").asText();

        // Rotation: the presented grant is retired — reuse fails with 401.
        assertThat(newGrant).isNotEqualTo(session.get("refreshToken").asText());
        mockMvc.perform(post("/api/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("refreshToken", session.get("refreshToken").asText()).toString()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void signOutRevokesTheRefreshGrant() throws Exception {
        seedUser("00000000-0000-0000-0000-0000000000d1", "signout@fixture.yacc.local",
                UserRole.USER, UserStatus.ACTIVE);
        MvcResult signIn = mockMvc.perform(post("/api/auth/sign-in/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("email", "signout@fixture.yacc.local")
                                .put("password", TEST_PASSWORD).toString()))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode session = mapper.readTree(signIn.getResponse().getContentAsString());

        mockMvc.perform(post("/api/auth/sign-out")
                        .header("Authorization", "Bearer " + session.get("accessToken").asText()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // The named refresh grant is revoked.
        mockMvc.perform(post("/api/auth/refresh-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("refreshToken", session.get("refreshToken").asText()).toString()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void suspendedIdentityIsDeniedOnProtectedRest() throws Exception {
        String userId = "00000000-0000-0000-0000-0000000000e1";
        String email = "deny@fixture.yacc.local";
        seedUser(userId, email, UserRole.USER, UserStatus.ACTIVE);
        String token = signIn(email, TEST_PASSWORD);

        mockMvc.perform(get("/api/auth/get-session").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());

        // Suspension after token issuance takes effect on the next request.
        User user = users.findById(userId).orElseThrow();
        user.setStatus(UserStatus.SUSPENDED);
        users.save(user);

        mockMvc.perform(get("/api/auth/get-session").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void inactiveIdentityIsDeniedOnProtectedRest() throws Exception {
        String userId = "00000000-0000-0000-0000-0000000000f1";
        String email = "inactive@fixture.yacc.local";
        seedUser(userId, email, UserRole.MANAGER, UserStatus.ACTIVE);
        String token = signIn(email, TEST_PASSWORD);

        User user = users.findById(userId).orElseThrow();
        user.setStatus(UserStatus.INACTIVE);
        users.save(user);

        mockMvc.perform(get("/api/auth/get-session").header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void bootstrapSuperAdminIsLockedUntilCredentialReplacement() throws Exception {
        String token = signIn(BOOTSTRAP_EMAIL, BOOTSTRAP_INITIAL_CREDENTIAL);

        // Authentication succeeds, but the flagged identity is denied every
        // non-auth path (403 password-change-required).
        mockMvc.perform(get("/api/test/rbac/super-admin").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Password change required"));

        // Wrong current credential is rejected.
        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("currentPassword", "wrong-current-password")
                                .put("newPassword", "replaced-credential-1").toString()))
                .andExpect(status().isUnauthorized());

        // Credential replacement clears the forced flag.
        mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("currentPassword", BOOTSTRAP_INITIAL_CREDENTIAL)
                                .put("newPassword", "replaced-credential-1").toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        mockMvc.perform(get("/api/test/rbac/super-admin").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").value("super-admin"));
    }

    @Test
    void rbacMatrixGatesEveryRoleExplicitly() throws Exception {
        seedUser("00000000-0000-0000-0000-000000000101", "rba@fixture.yacc.local",
                UserRole.SUPER_ADMIN, UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-000000000102", "rba-admin@fixture.yacc.local",
                UserRole.ADMIN, UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-000000000103", "rba-manager@fixture.yacc.local",
                UserRole.MANAGER, UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-000000000104", "rba-user@fixture.yacc.local",
                UserRole.USER, UserStatus.ACTIVE);

        record Gate(String path, UserRole allowed) {}

        Gate[] gates = {
                new Gate("/api/test/rbac/super-admin", UserRole.SUPER_ADMIN),
                new Gate("/api/test/rbac/admin", UserRole.ADMIN),
                new Gate("/api/test/rbac/manager", UserRole.MANAGER),
                new Gate("/api/test/rbac/user", UserRole.USER),
        };

        for (Gate gate : gates) {
            for (UserRole role : UserRole.values()) {
                String email = switch (role) {
                        case SUPER_ADMIN -> "rba@fixture.yacc.local";
                        case ADMIN -> "rba-admin@fixture.yacc.local";
                        case MANAGER -> "rba-manager@fixture.yacc.local";
                        case USER -> "rba-user@fixture.yacc.local";
                };
                String token = signIn(email, TEST_PASSWORD);
                org.springframework.test.web.servlet.ResultMatcher expected = role == gate.allowed()
                        ? status().isOk()
                        : status().isForbidden();
                mockMvc.perform(get(gate.path()).header("Authorization", "Bearer " + token))
                        .andExpect(expected);
            }
        }
    }

    @Test
    void foreignKeySignedTokenIsRejectedByTheResourceServer() throws Exception {
        // A syntactically valid JWT signed with a key the service never
        // issued: the real resource-server decoder rejects the signature and
        // the chain denies the request with the frozen 401 shape.
        java.security.KeyPairGenerator generator =
                java.security.KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        java.security.KeyPair foreignPair = generator.generateKeyPair();
        org.springframework.security.oauth2.jwt.JwtEncoder foreignEncoder =
                new org.springframework.security.oauth2.jwt.NimbusJwtEncoder(
                        new com.nimbusds.jose.jwk.source.ImmutableJWKSet<>(
                                new com.nimbusds.jose.jwk.JWKSet(
                                        new com.nimbusds.jose.jwk.RSAKey.Builder(
                                                (java.security.interfaces.RSAPublicKey) foreignPair.getPublic())
                                                .privateKey((java.security.interfaces.RSAPrivateKey) foreignPair.getPrivate())
                                                .build())));
        String foreignToken = foreignEncoder.encode(
                org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(
                        org.springframework.security.oauth2.jwt.JwtClaimsSet.builder()
                                .issuer("attacker")
                                .issuedAt(java.time.Instant.now())
                                .expiresAt(java.time.Instant.now().plusSeconds(300))
                                .subject("00000000-0000-0000-0000-000000000101")
                                .build()))
                .getTokenValue();

        mockMvc.perform(get("/api/auth/get-session")
                        .header("Authorization", "Bearer " + foreignToken))
                .andExpect(status().isUnauthorized());
    }
}
