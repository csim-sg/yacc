package com.yacc.auth;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.server.authorization.client.InMemoryRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.stereotype.Component;

/**
 * Registered-client policy for the embedded authorization server (MIG-033;
 * ADR-025 AS role; ARCH-004 §8) — split out of the AS configuration (review
 * loop 1: configuration stays wiring, policy lives here).
 *
 * <p>Founder-fixed policy: the YACC frontend only, config-driven through
 * {@code yacc.auth.as.clients.*} (ARCH-004 §4). Registered clients are
 * public OIDC SPA clients — no client secret, authorization-code + PKCE
 * (S256, mandatory) + refresh; consent is always required. Token TTLs reuse
 * the shared {@code yacc.auth.token} policy (single source); refresh tokens
 * rotate on every use ({@code reuseRefreshTokens=false} — MIG-030
 * {@code SessionService.rotate} parity). Validation is eager and
 * fail-closed: no clients, missing id, missing redirect URI, or a missing
 * {@code openid} scope fails startup.</p>
 */
@Component
public class AsClientPolicy implements RegisteredClientRepository {

    private final RegisteredClientRepository delegate;

    /** Constructor injection only (guardrails 004 §2; ADR-024; ADR-030). */
    public AsClientPolicy(AuthProperties properties) {
        Map<String, AuthProperties.As.AsClient> clients = properties.as().clients();
        if (clients.isEmpty()) {
            throw new IllegalStateException(
                    "yacc.auth.as.clients must register at least one client"
                            + " (the YACC frontend); refusing to start the"
                            + " authorization server with no registered clients");
        }
        List<RegisteredClient> registered = clients.entrySet().stream()
                .map(entry -> registeredClient(entry.getKey(), entry.getValue(), properties))
                .toList();
        this.delegate = new InMemoryRegisteredClientRepository(registered);
    }

    @Override
    public void save(RegisteredClient registeredClient) {
        this.delegate.save(registeredClient);
    }

    @Override
    public RegisteredClient findById(String id) {
        return this.delegate.findById(id);
    }

    @Override
    public RegisteredClient findByClientId(String clientId) {
        return this.delegate.findByClientId(clientId);
    }

    private static RegisteredClient registeredClient(String registrationId,
            AuthProperties.As.AsClient client, AuthProperties properties) {
        String prefix = "yacc.auth.as.clients." + registrationId;
        if (client.clientId() == null || client.clientId().isBlank()) {
            throw new IllegalStateException(prefix + ".client-id is required");
        }
        if (client.redirectUris() == null || client.redirectUris().isEmpty()) {
            throw new IllegalStateException(
                    prefix + ".redirect-uris must list at least one exact redirect URI");
        }
        List<String> scopes = client.scopes() == null || client.scopes().isEmpty()
                ? AuthProperties.As.AsClient.DEFAULT_SCOPES
                : client.scopes();
        if (!scopes.contains(OidcScopes.OPENID)) {
            throw new IllegalStateException(
                    prefix + ".scopes must include the openid scope (OIDC client)");
        }
        return RegisteredClient.withId(UUID.randomUUID().toString())
                .clientId(client.clientId())
                .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
                .redirectUris(uris -> uris.addAll(client.redirectUris()))
                .scopes(s -> s.addAll(scopes))
                .clientSettings(ClientSettings.builder()
                        .requireAuthorizationConsent(true)
                        .requireProofKey(true)
                        .build())
                .tokenSettings(TokenSettings.builder()
                        .accessTokenTimeToLive(properties.token().accessTtl())
                        .refreshTokenTimeToLive(properties.token().refreshTtl())
                        .reuseRefreshTokens(false)
                        .build())
                .build();
    }
}
