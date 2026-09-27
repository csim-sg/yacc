package com.yacc.auth.service;

import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import org.springframework.stereotype.Service;

import com.yacc.auth.AuthProperties;
import com.yacc.auth.model.AuthUser;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtEncodingException;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;

/**
 * Stateless JWT access-token service (MIG-030; ADR-025). Signs RS256 access
 * tokens with Spring Security's standard {@link JwtEncoder} and verifies them
 * with {@link JwtDecoder} — no bespoke token crypto (the BETTER_AUTH_SECRET
 * coupling is unwound).
 *
 * <p>The signing key is standard RSA material (base64 PKCS#8, >= 2048 bits)
 * from {@link AuthProperties.Token}; the public key is derived from the
 * private CRT parts. The key is validated eagerly at construction and
 * verified for minimum size — a missing or weak key fails startup
 * (fail-closed), mirroring the MIG-021 encryption-key contract. This
 * asymmetric key family is the foundation the embedded OIDC authorization
 * server (MIG-033, JWKS) and the relying party (MIG-032) build on.</p>
 */
@Service
public class JwtTokenService {

    /** Token issuer claim value. */
    static final String ISSUER = "yacc";

    /** Session (refresh-grant) id claim — links an access token to its grant. */
    public static final String CLAIM_SESSION_ID = "sid";

    /** Lowercase wire role claim (informational; authorities come from DB). */
    public static final String CLAIM_ROLE = "role";

    /** Email claim. */
    public static final String CLAIM_EMAIL = "email";

    private static final int MIN_KEY_BITS = 2048;

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final AuthProperties.Token policy;

    public JwtTokenService(AuthProperties properties) {
        this.policy = properties.token();
        RSAKey rsaKey = parseKey(properties.token().signingKey());
        this.encoder = new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(rsaKey)));
        this.decoder = buildDecoder(rsaKey);
    }

    /** The decoder backing the resource-server filter chain (single instance). */
    public JwtDecoder jwtDecoder() {
        return decoder;
    }

    private static JwtDecoder buildDecoder(RSAKey rsaKey) {
        java.security.interfaces.RSAPublicKey publicKey;
        try {
            publicKey = rsaKey.toRSAPublicKey();
        } catch (JOSEException e) {
            throw new IllegalStateException("RSA public key extraction failed", e);
        }
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(publicKey).build();
        // Zero clock skew: issuer and verifier share the single-instance host
        // clock (KISS; ADR-029 single-instance envelope).
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(Duration.ZERO), new JwtIssuerValidator(ISSUER)));
        return decoder;
    }

    /**
     * Issues a signed RS256 access token for the authenticated identity.
     *
     * @param user      authenticated identity
     * @param sessionId id of the owning refresh grant ({@code sid} claim)
     * @return the encoded JWT in compact serialized form
     */
    public String issueAccessToken(AuthUser user, String sessionId) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .issuedAt(now)
                .expiresAt(now.plus(policy.accessTtl()))
                .subject(user.getId())
                .claim(CLAIM_SESSION_ID, sessionId)
                .claim(CLAIM_EMAIL, user.getEmail())
                .claim(CLAIM_ROLE, user.getRole().getLabel())
                .build();
        try {
            return encoder.encode(JwtEncoderParameters.from(claims)).getTokenValue();
        } catch (JwtEncodingException e) {
            throw new IllegalStateException("Access-token encoding failed", e);
        }
    }

    /**
     * Decodes and verifies a compact serialized access token (signature,
     * expiry, issuer).
     *
     * @param token compact serialized JWT
     * @return the decoded {@link Jwt}
     * @throws org.springframework.security.oauth2.jwt.JwtValidationException
     *         when the token is invalid, tampered, or expired
     */
    public Jwt decodeAccessToken(String token) {
        return decoder.decode(token);
    }

    private static RSAKey parseKey(String signingKeyBase64) {
        if (signingKeyBase64 == null || signingKeyBase64.isBlank()) {
            throw new IllegalStateException(
                    "yacc.auth.token.signing-key is not configured"
                            + " (env YACC_AUTH_TOKEN_SIGNING_KEY); refusing to start"
                            + " without token-signing key material (fail-closed, ADR-025)");
        }
        RSAPrivateCrtKey privateKey;
        try {
            byte[] der = Base64.getDecoder().decode(signingKeyBase64.trim());
            privateKey = (RSAPrivateCrtKey) KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(der));
        } catch (IllegalArgumentException | java.security.GeneralSecurityException
                | ClassCastException e) {
            throw new IllegalStateException(
                    "yacc.auth.token.signing-key is not a base64 PKCS#8 RSA private key", e);
        }
        if (privateKey.getModulus().bitLength() < MIN_KEY_BITS) {
            throw new IllegalStateException(
                    "yacc.auth.token.signing-key must be an RSA key of at least "
                            + MIN_KEY_BITS + " bits; got " + privateKey.getModulus().bitLength());
        }
        RSAPublicKey publicKey = derivePublicKey(privateKey);
        return new RSAKey.Builder(publicKey).privateKey(privateKey).keyID("yacc-access-token").build();
    }

    private static RSAPublicKey derivePublicKey(RSAPrivateCrtKey privateKey) {
        try {
            return (RSAPublicKey) KeyFactory.getInstance("RSA")
                    .generatePublic(new RSAPublicKeySpec(privateKey.getModulus(),
                            privateKey.getPublicExponent()));
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("RSA public key derivation failed", e);
        }
    }
}
