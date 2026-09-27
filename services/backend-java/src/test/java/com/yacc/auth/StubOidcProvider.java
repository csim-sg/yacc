package com.yacc.auth;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

/**
 * Deterministic in-process OIDC provider stub for the MIG-032 relying-party
 * integration tests (no external network — the AbstractPostgresIntegrationTest
 * convention). Serves exactly two IdP surfaces over loopback HTTP:
 *
 * <ul>
 *   <li>{@code POST /token} — authorization-code exchange; each code is
 *       minted via {@link #mint} and is single-use, binding the identity and
 *       the authorization-request nonce (real IdP behavior: the browser
 *       carries the nonce, the IdP binds it to the code);</li>
 *   <li>{@code GET /jwks} — the public key backing the RS256 ID tokens.</li>
 * </ul>
 *
 * <p>ID tokens carry iss/sub/aud/iat/exp plus the nonce hash and e-mail
 * claims, signed with the stub's RSA key — Spring Security validates
 * signature (JWKS), issuer, audience, timestamps, and the nonce hash exactly
 * as it would against a real IdP.</p>
 */
final class StubOidcProvider {

    static final String CLIENT_ID = "test-client";

    /**
     * One minted external identity, bound to a single-use code. The nonce is
     * the value received on the authorization request — Spring Security's
     * client sends its hash there and expects the ID token's nonce claim to
     * carry exactly that value (OIDC core §3.1.2.1 nonce binding).
     */
    record Identity(String subject, String email, boolean emailVerified, String nonce) {
    }

    private final HttpServer server;

    private final RSAKey signingKey;

    private final Map<String, Identity> minted = new ConcurrentHashMap<>();

    StubOidcProvider() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            KeyPair pair = generator.generateKeyPair();
            this.signingKey = new RSAKey.Builder((RSAPublicKey) pair.getPublic())
                    .privateKey((RSAPrivateKey) pair.getPrivate())
                    .keyID("stub-oidc-key")
                    .build();
            this.server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
            this.server.createContext("/token", this::handleToken);
            this.server.createContext("/jwks", this::handleJwks);
            this.server.start();
        } catch (NoSuchAlgorithmException | IOException ex) {
            throw new IllegalStateException("stub OIDC provider failed to start", ex);
        }
    }

    /** The issuer URI to configure on the relying-party registration. */
    String issuer() {
        return "http://localhost:" + server.getAddress().getPort();
    }

    /**
     * Mints a single-use authorization code bound to the identity and the
     * authorization-request nonce (mirrors a real IdP authorization step).
     */
    String mint(String subject, String email, boolean emailVerified, String nonce) {
        String code = "code-" + UUID.randomUUID();
        minted.put(code, new Identity(subject, email, emailVerified, nonce));
        return code;
    }

    void stop() {
        server.stop(0);
    }

    private void handleToken(HttpExchange exchange) throws IOException {
        String code = readCode(exchange);
        Identity identity = code == null ? null : minted.remove(code);
        if (identity == null) {
            respond(exchange, 400, "{\"error\":\"invalid_grant\"}");
            return;
        }
        String idToken = idToken(identity);
        respond(exchange, 200, "{\"access_token\":\"stub-access-token\",\"token_type\":\"Bearer\","
                + "\"expires_in\":\"300\",\"id_token\":\"" + idToken + "\"}");
    }

    private void handleJwks(HttpExchange exchange) throws IOException {
        respond(exchange, 200, new JWKSet(signingKey.toPublicJWK()).toString());
    }

    private String readCode(HttpExchange exchange) throws IOException {
        try (InputStream body = exchange.getRequestBody()) {
            String form = new String(body.readAllBytes(), StandardCharsets.US_ASCII);
            for (String pair : form.split("&")) {
                String[] nameValue = pair.split("=", 2);
                if (nameValue.length == 2 && nameValue[0].equals("code")) {
                    return nameValue[1];
                }
            }
        }
        return null;
    }

    private String idToken(Identity identity) {
        try {
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .issuer(issuer())
                    .subject(identity.subject())
                    .audience(List.of(CLIENT_ID))
                    .issueTime(Date.from(Instant.now()))
                    .expirationTime(Date.from(Instant.now().plusSeconds(300)))
                    .claim("nonce", identity.nonce())
                    .claim("email", identity.email())
                    .claim("email_verified", identity.emailVerified())
                    .build();
            SignedJWT jwt = new SignedJWT(
                    new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(signingKey.getKeyID()).build(),
                    claims);
            jwt.sign(new RSASSASigner(signingKey.toPrivateKey()));
            return jwt.serialize();
        } catch (Exception ex) {
            throw new IllegalStateException("stub ID-token minting failed", ex);
        }
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.US_ASCII);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }
}
