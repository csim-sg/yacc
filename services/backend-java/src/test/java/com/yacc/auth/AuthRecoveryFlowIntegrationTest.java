package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.model.PasswordResetToken;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.PasswordResetTokenRepository;
import com.yacc.auth.repository.UserRepository;
import com.yacc.auth.service.AuthEmailSender;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * MIG-031 end-to-end wire tests (AC-MIG-031-1/-2) through the real Spring
 * Security filter chain over the real PostgreSQL data layer: forgot-password
 * always-200 anti-enumeration, token-based password reset with expiration/
 * consumption/replay protection, forced-password-change integration
 * (bootstrap identity recovers through the same flow), email verification,
 * the public-path openings, and the 3/h/IP rate limit. The email transport
 * is mocked; no provider is ever contacted.
 */
@AutoConfigureMockMvc
@Transactional
class AuthRecoveryFlowIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final Pattern TOKEN_PATTERN =
            Pattern.compile("token=([0-9a-f]{64})");

    private static final String FORGOT_PASSWORD_MESSAGE =
            "If an email exists, a password reset link has been sent";

    private final MockMvc mockMvc;

    private final UserRepository users;

    private final PasswordResetTokenRepository resetTokens;

    private final ObjectMapper mapper;

    @MockitoBean
    private AuthEmailSender authEmailSender;

    @Autowired
    AuthRecoveryFlowIntegrationTest(MockMvc mockMvc, UserRepository users,
            PasswordResetTokenRepository resetTokens, ObjectMapper mapper) {
        this.mockMvc = mockMvc;
        this.users = users;
        this.resetTokens = resetTokens;
        this.mapper = mapper;
    }

    private String seedUser(String id, String email, UserRole role, UserStatus status,
            boolean mustChangePassword) {
        User user = new User(id, email, "Fixture " + role.getLabel(),
                new BCryptPasswordEncoder().encode("original-password-123"),
                role, status, true);
        user.setMustChangePassword(mustChangePassword);
        users.save(user);
        return email;
    }

    private MockHttpServletRequestBuilder postJson(String uri, String body, String remoteAddr) {
        return post(uri)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                // A unique per-test source address isolates the in-memory
                // rate-limit windows across the shared cached context.
                .with(request -> {
                    request.setRemoteAddr(remoteAddr);
                    return request;
                });
    }

    private String resetTokenFromEmail(String to) {
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(authEmailSender).send(eq(to), eq("Reset your YACC password"),
                bodyCaptor.capture());
        Matcher matcher = TOKEN_PATTERN.matcher(bodyCaptor.getValue());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private String verificationTokenFromEmail(String to) {
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(authEmailSender).send(eq(to), eq("Verify your YACC email"),
                bodyCaptor.capture());
        Matcher matcher = TOKEN_PATTERN.matcher(bodyCaptor.getValue());
        assertThat(matcher.find()).isTrue();
        return matcher.group(1);
    }

    private String signIn(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/auth/sign-in/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("email", email)
                                .put("password", password).toString()))
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    @Test
    void forgotPasswordAnswersConstant200ForUnknownAndKnownAddresses() throws Exception {
        // Unknown address: same constant 200 (anti-enumeration), no email.
        mockMvc.perform(postJson("/api/auth/forgot-password",
                        mapper.createObjectNode().put("email", "ghost@fixture.yacc.local")
                                .toString(), "10.1.0.1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(FORGOT_PASSWORD_MESSAGE));
        verify(authEmailSender, never()).send(anyString(), anyString(), anyString());

        // Registered address: identical wire answer, reset email delivered.
        seedUser("00000000-0000-0000-0000-000000003101",
                "known@fixture.yacc.local", UserRole.USER, UserStatus.ACTIVE, false);
        mockMvc.perform(postJson("/api/auth/forgot-password",
                        mapper.createObjectNode().put("email", "known@fixture.yacc.local")
                                .toString(), "10.1.0.2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value(FORGOT_PASSWORD_MESSAGE));
        verify(authEmailSender).send(eq("known@fixture.yacc.local"),
                eq("Reset your YACC password"), contains("/reset-password?token="));
    }

    @Test
    void resetFlowReplacesTheCredentialAndRejectsReplay() throws Exception {
        String email = seedUser("00000000-0000-0000-0000-000000003202",
                "recovery@fixture.yacc.local", UserRole.USER, UserStatus.ACTIVE, false);

        // Before the reset the current credential still authenticates.
        assertThat(signIn(email, "original-password-123")).contains("accessToken");

        mockMvc.perform(postJson("/api/auth/forgot-password",
                        mapper.createObjectNode().put("email", email).toString(),
                        "10.2.0.1"))
                .andExpect(status().isOk());
        String token = resetTokenFromEmail(email);

        mockMvc.perform(postJson("/api/auth/reset-password", mapper.createObjectNode()
                                .put("token", token)
                                .put("password", "fresh-recovery-password-1").toString(),
                        "10.2.0.1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Password reset successfully"));

        // After the reset the old credential is dead ("no old credential
        // restore") and the fresh one authenticates.
        assertThat(signIn(email, "original-password-123"))
                .contains("Invalid credentials");
        assertThat(signIn(email, "fresh-recovery-password-1")).contains("accessToken");

        // Replay: the consumed token fails generically (single-use).
        mockMvc.perform(postJson("/api/auth/reset-password", mapper.createObjectNode()
                                .put("token", token)
                                .put("password", "fresh-recovery-password-1").toString(),
                        "10.2.0.1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid or expired token"));
    }

    @Test
    void resetRejectsExpiredAndUnknownTokensGenerically() throws Exception {
        // Directly stored expired token: the digest form proves the lookup
        // path (bcrypt match) and the expiry gate.
        String email = seedUser("00000000-0000-0000-0000-000000003303",
                "expired@fixture.yacc.local", UserRole.USER, UserStatus.ACTIVE, false);
        String staleToken = "a".repeat(64);
        resetTokens.save(new PasswordResetToken(
                users.findByEmail(email).orElseThrow().getId(),
                new BCryptPasswordEncoder().encode(staleToken),
                LocalDateTime.now().minusMinutes(1)));

        mockMvc.perform(postJson("/api/auth/reset-password", mapper.createObjectNode()
                                .put("token", staleToken)
                                .put("password", "unused-password-1").toString(),
                        "10.3.0.1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid or expired token"));

        mockMvc.perform(postJson("/api/auth/reset-password", mapper.createObjectNode()
                                .put("token", "b".repeat(64))
                                .put("password", "unused-password-1").toString(),
                        "10.3.0.1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid or expired token"));
    }

    @Test
    void bootstrapIdentityRecoversThroughTheResetFlowAndClearsTheForcedChange()
            throws Exception {
        // Forced-password-change integration: a recovery-provisioned
        // identity (must_change_password, the ADR-025 bootstrap/recovery
        // state) completes the same token flow — a fresh credential
        // replaces the old one and the forced flag clears (AC-MIG-031-2).
        String email = seedUser("00000000-0000-0000-0000-000000003404",
                "forced@fixture.yacc.local", UserRole.SUPER_ADMIN, UserStatus.ACTIVE,
                true);
        mockMvc.perform(postJson("/api/auth/forgot-password",
                        mapper.createObjectNode().put("email", email).toString(), "10.4.0.1"))
                .andExpect(status().isOk());
        String token = resetTokenFromEmail(email);

        mockMvc.perform(postJson("/api/auth/reset-password", mapper.createObjectNode()
                        .put("token", token)
                        .put("password", "replaced-bootstrap-credential-1").toString(),
                "10.4.0.1"))
                .andExpect(status().isOk());
        User recovered = users.findByEmail(email).orElseThrow();
        assertThat(recovered.isMustChangePassword()).isFalse();
        assertThat(signIn(email, "replaced-bootstrap-credential-1"))
                .contains("accessToken");
    }

    @Test
    void signUpIssuesTheVerificationChallengeAndConfirmationFlipsEmailVerified()
            throws Exception {
        mockMvc.perform(postJson("/api/auth/sign-up/email",
                        mapper.createObjectNode()
                                .put("email", "verifier@fixture.yacc.local")
                                .put("password", "password-123")
                                .put("name", "Verifier").toString(), "10.5.0.1"))
                .andExpect(status().isCreated());
        String token = verificationTokenFromEmail("verifier@fixture.yacc.local");

        mockMvc.perform(postJson("/api/auth/verify-email",
                        mapper.createObjectNode().put("token", token).toString(),
                        "10.5.0.1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Email verified successfully"));
        assertThat(users.findByEmail("verifier@fixture.yacc.local").orElseThrow()
                .isEmailVerified()).isTrue();

        // Replay: the consumed challenge resolves to nothing.
        mockMvc.perform(postJson("/api/auth/verify-email",
                        mapper.createObjectNode().put("token", token).toString(),
                        "10.5.0.1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid or expired token"));
    }

    @Test
    void tokenFlowsArePublicAndFailClosedWithoutCredentials() throws Exception {
        // No Authorization header anywhere: public openings answer their
        // contract responses (never 401) — forgot is constant-200, reset
        // and verify fail generic-400 on an invalid token.
        mockMvc.perform(postJson("/api/auth/forgot-password",
                        mapper.createObjectNode().put("email", "x@fixture.yacc.local")
                                .toString(), "10.6.0.1"))
                .andExpect(status().isOk());
        mockMvc.perform(postJson("/api/auth/reset-password", mapper.createObjectNode()
                        .put("token", "c".repeat(64))
                        .put("password", "unused-password-1").toString(), "10.6.0.1"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(postJson("/api/auth/verify-email",
                        mapper.createObjectNode().put("token", "d".repeat(64)).toString(),
                        "10.6.0.1"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void forgotPasswordIsRateLimitedToThreeRequestsPerHourPerAddress()
            throws Exception {
        for (int i = 0; i < 3; i++) {
            mockMvc.perform(postJson("/api/auth/forgot-password",
                            mapper.createObjectNode().put("email", "x@fixture.yacc.local")
                                    .toString(), "10.7.0.1"))
                    .andExpect(status().isOk());
        }
        mockMvc.perform(postJson("/api/auth/forgot-password",
                        mapper.createObjectNode().put("email", "x@fixture.yacc.local")
                                .toString(), "10.7.0.1"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error")
                        .value("Too many password reset attempts. Please try again in 1 hour."));

        // A different source address keeps its own budget.
        mockMvc.perform(postJson("/api/auth/forgot-password",
                        mapper.createObjectNode().put("email", "x@fixture.yacc.local")
                                .toString(), "10.7.0.99"))
                .andExpect(status().isOk());
    }

    @Test
    void issuedTokenIsStoredOnlyAsADigest() throws Exception {
        seedUser("00000000-0000-0000-0000-000000003605", "digest@fixture.yacc.local",
                UserRole.USER, UserStatus.ACTIVE, false);
        mockMvc.perform(postJson("/api/auth/forgot-password",
                        mapper.createObjectNode().put("email", "digest@fixture.yacc.local")
                                .toString(), "10.8.0.1"))
                .andExpect(status().isOk());
        String rawToken = resetTokenFromEmail("digest@fixture.yacc.local");

        PasswordResetToken stored = resetTokens.findByUsedAtIsNull().stream()
                .filter(record -> record.getUserId()
                        .equals(users.findByEmail("digest@fixture.yacc.local")
                                .orElseThrow().getId()))
                .findFirst().orElseThrow();
        // The 256-bit raw value never touches the database — only the
        // bcrypt digest (BE-003 parity: tokens hashed in database).
        assertThat(stored.getToken()).isNotEqualTo(rawToken).startsWith("$2");
        assertThat(new BCryptPasswordEncoder().matches(rawToken, stored.getToken()))
                .isTrue();
    }
}
