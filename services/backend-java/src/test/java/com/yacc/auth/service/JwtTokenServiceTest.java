package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;

import org.junit.jupiter.api.Test;

import org.springframework.security.oauth2.jwt.BadJwtException;

import com.yacc.auth.AuthProperties;
import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;

/**
 * Unit tests for the stateless JWT access-token service (AC-MIG-030-1;
 * ADR-025): fail-closed key parsing, RS256 round-trip, claim shape, and
 * rejection of tampered/expired/wrong-key tokens.
 */
class JwtTokenServiceTest {

    private static AuthProperties properties(String signingKeyBase64) {
        return new AuthProperties(
                new AuthProperties.Token(signingKeyBase64, null, null),
                new AuthProperties.Bootstrap("bootstrap@fixture.yacc.local", "initial"),
                new AuthProperties.Recovery("", "", ""), null, null, null);
    }

    private static String generatedKey(int bits) {
        try {
            KeyPair pair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
            // Re-generate at the requested size through the generator params.
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(bits);
            pair = generator.generateKeyPair();
            return Base64.getEncoder().encodeToString(
                    pair.getPrivate().getEncoded());
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static AuthUser user(String id, UserRole role) {
        return new AuthUser(new User(id, "user@fixture.yacc.local", "Fixture",
                "hash", role, UserStatus.ACTIVE, true));
    }

    @Test
    void issuesAndVerifiesRoundTripTokens() {
        JwtTokenService service = new JwtTokenService(properties(generatedKey(2048)));

        String token = service.issueAccessToken(user("user-1", UserRole.MANAGER), "session-1");
        var jwt = service.decodeAccessToken(token);

        assertThat(jwt.getSubject()).isEqualTo("user-1");
        assertThat(jwt.getClaimAsString("iss")).isEqualTo("yacc");
        assertThat(jwt.getClaimAsString(JwtTokenService.CLAIM_SESSION_ID)).isEqualTo("session-1");
        assertThat(jwt.getClaimAsString(JwtTokenService.CLAIM_EMAIL)).isEqualTo("user@fixture.yacc.local");
        assertThat(jwt.getClaimAsString(JwtTokenService.CLAIM_ROLE)).isEqualTo("manager");
    }

    @Test
    void rejectsTamperedTokens() {
        JwtTokenService service = new JwtTokenService(properties(generatedKey(2048)));
        String token = service.issueAccessToken(user("user-1", UserRole.USER), "session-1");
        String tampered = token.substring(0, token.length() - 4)
                + (token.endsWith("AAAA") ? "BBBB" : "AAAA");

        assertThatThrownBy(() -> service.decodeAccessToken(tampered))
                .isInstanceOf(BadJwtException.class);
    }

    @Test
    void rejectsTokensSignedWithAnotherKey() {
        JwtTokenService signer = new JwtTokenService(properties(generatedKey(2048)));
        JwtTokenService verifier = new JwtTokenService(properties(generatedKey(2048)));

        String token = signer.issueAccessToken(user("user-1", UserRole.USER), "session-1");

        assertThatThrownBy(() -> verifier.decodeAccessToken(token))
                .isInstanceOf(BadJwtException.class);
    }

    @Test
    void rejectsExpiredTokens() throws Exception {
        JwtTokenService service = new JwtTokenService(new AuthProperties(
                new AuthProperties.Token(generatedKey(2048),
                        java.time.Duration.ofSeconds(1), java.time.Duration.ofDays(30)),
                new AuthProperties.Bootstrap("bootstrap@fixture.yacc.local", "initial"),
                new AuthProperties.Recovery("", "", ""), null, null, null));

        String token = service.issueAccessToken(user("user-1", UserRole.USER), "session-1");
        Thread.sleep(1500);

        assertThatThrownBy(() -> service.decodeAccessToken(token))
                .isInstanceOf(BadJwtException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void missingSigningKeyFailsStartup() {
        assertThatThrownBy(() -> new JwtTokenService(properties("  ")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("fail-closed");
    }

    @Test
    void malformedSigningKeyFailsStartup() {
        assertThatThrownBy(() -> new JwtTokenService(properties("not-base64!!!")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("PKCS#8");
    }

    @Test
    void undersizedSigningKeyFailsStartup() {
        assertThatThrownBy(() -> new JwtTokenService(properties(generatedKey(1024))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("2048");
    }
}
