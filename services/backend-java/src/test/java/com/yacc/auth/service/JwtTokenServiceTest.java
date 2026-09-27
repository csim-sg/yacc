package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Instant;
import java.util.Base64;

import org.junit.jupiter.api.Test;

import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import com.nimbusds.jose.jwk.source.ImmutableJWKSet;

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
                new AuthProperties.Recovery("", "", ""), null, null, null, null, null);
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
                new AuthProperties.Recovery("", "", ""), null, null, null, null, null));

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

    // --- MIG-033: embedded authorization-server token compatibility ---

    /**
     * MIG-033 compat: a token stamped with the embedded AS issuer but signed
     * by the SAME shared key family decodes (the resource server verifies
     * AS-issued tokens — one token format, one signing-key source).
     */
    @Test
    void acceptsAsIssuedIssuerTokensFromTheSharedKey() {
        AuthProperties props = properties(generatedKey(2048));
        JwtTokenService service = new JwtTokenService(props);

        String asIssuedToken = signedWith(service.signingKey(),
                props.as().issuer(), "user-as-1");

        var jwt = service.decodeAccessToken(asIssuedToken);
        assertThat(jwt.getIssuer().toString()).isEqualTo(props.as().issuer());
        assertThat(jwt.getSubject()).isEqualTo("user-as-1");
    }

    /** A correctly signed token carrying a foreign issuer is rejected. */
    @Test
    void rejectsForeignIssuerTokens() {
        AuthProperties props = properties(generatedKey(2048));
        JwtTokenService service = new JwtTokenService(props);

        String foreignToken = signedWith(service.signingKey(), "https://evil.example", "user-1");

        assertThatThrownBy(() -> service.decodeAccessToken(foreignToken))
                .isInstanceOf(BadJwtException.class)
                .hasMessageContaining("issuer");
    }

    /**
     * Rotation (MIG-033; single signing-key source): rotating the env key
     * rotates encoder, decoder and the AS JWKSource together — outstanding
     * old-key tokens no longer verify, new-key tokens do, and the JWKS
     * material served after rotation is exactly the new key.
     */
    @Test
    void keyRotationSwitchesSigningVerificationAndJwksMaterial() {
        JwtTokenService before = new JwtTokenService(properties(generatedKey(2048)));
        String outstandingToken = before.issueAccessToken(user("user-1", UserRole.USER),
                "session-1");

        JwtTokenService after = new JwtTokenService(properties(generatedKey(2048)));

        // The outstanding pre-rotation token no longer verifies...
        assertThatThrownBy(() -> after.decodeAccessToken(outstandingToken))
                .isInstanceOf(BadJwtException.class);
        // ...and post-rotation signing works.
        String rotatedToken = after.issueAccessToken(user("user-1", UserRole.USER), "session-2");
        assertThat(after.decodeAccessToken(rotatedToken).getClaimAsString("iss")).isEqualTo("yacc");
        // The JWKS material after rotation is the NEW key (different modulus).
        assertThat(after.signingKey().toPublicJWK().getModulus())
                .isNotEqualTo(before.signingKey().toPublicJWK().getModulus());
    }

    /**
     * Mints an RS256 token with an explicit issuer using the SAME signing
     * key (test-side mimicry of the AS token mint path; no production
     * crypto involved).
     */
    private static String signedWith(com.nimbusds.jose.jwk.RSAKey key, String issuer,
            String subject) {
        try {
            org.springframework.security.oauth2.jwt.JwtEncoder encoder = new NimbusJwtEncoder(
                    new ImmutableJWKSet<>(new com.nimbusds.jose.jwk.JWKSet(key)));
            Instant now = Instant.now();
            var claims = org.springframework.security.oauth2.jwt.JwtClaimsSet.builder()
                    .issuer(issuer)
                    .issuedAt(now)
                    .expiresAt(now.plusSeconds(60))
                    .subject(subject)
                    .claim(JwtTokenService.CLAIM_ROLE, "user")
                    .claim(JwtTokenService.CLAIM_EMAIL, "user@fixture.yacc.local")
                    .build();
            return encoder
                    .encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(claims))
                    .getTokenValue();
        } catch (org.springframework.security.oauth2.jwt.JwtEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
