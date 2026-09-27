package com.yacc.auth;

import jakarta.servlet.http.HttpServletRequest;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.core.endpoint.PkceParameterNames;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.InMemoryRegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configurers.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configurers.OidcConfigurer;
import org.springframework.security.oauth2.server.authorization.oidc.authentication.OidcUserInfoAuthenticationContext;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.security.oauth2.server.authorization.token.DelegatingOAuth2TokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.JwtGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2AccessTokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.security.oauth2.server.authorization.web.OAuth2AuthorizationEndpointFilter;
import org.springframework.security.oauth2.server.authorization.web.authentication.ClientSecretBasicAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.ClientSecretPostAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.DelegatingAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.JwtClientAssertionAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.PublicClientAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationProvider;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.AuthenticationConverter;
import org.springframework.security.web.header.HeaderWriterFilter;
import org.springframework.security.web.util.matcher.AnyRequestMatcher;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.yacc.auth.model.AuthUser;
import com.yacc.auth.service.BearerTokenAuthenticationConverter;
import com.yacc.auth.service.JwtTokenService;

/**
 * Embedded OIDC authorization server (MIG-033; ADR-025 AS role; ARCH-004 §8).
 * The founder-fixed dual-role OIDC posture: YACC is both relying party
 * (MIG-032) and authorization server — the AS is embedded in the single
 * backend via Spring Authorization Server; no Keycloak/broker (ADR-025).
 *
 * <p>Framework-standard endpoints only — {@code /oauth2/authorize},
 * {@code /oauth2/token}, {@code /oauth2/jwks}, {@code /oauth2/revoke},
 * {@code /oauth2/consent}, {@code /.well-known/openid-configuration},
 * {@code /userinfo} — served by the framework with no hand-rolled
 * controllers; the set is OIDC/OAuth 2.1 standard surface and outside the
 * frozen {@code /api/*} REST contract (ADR-023). This configuration owns the
 * AS filter chain exclusively: it matches only the AS endpoint matcher and
 * runs BEFORE the {@code AuthSecurityConfig} API chain, which stays
 * byte-identical to MIG-032.</p>
 *
 * <p>Token policy (one format, one signing-key source): AS-issued tokens are
 * RS256 JWTs signed by the SAME key family as the resource server
 * ({@link JwtTokenService#signingKey()}); the authorization-endpoint
 * resource owner authenticates with the ordinary MIG-030 Bearer access
 * token through the same decoder and status-enforcing converter — inactive
 * or suspended identities are denied at the AS exactly as on every protected
 * REST path (fail-closed at both roles). No client-credentials grant exists
 * (no machine client is named — KISS); no second token format, no second
 * signing-key source.</p>
 *
 * <p>Registered-client policy (founder-fixed): the YACC frontend only,
 * config-driven through {@code yacc.auth.as.clients.*} (ARCH-004 §4). The
 * frontend is a public OIDC SPA client — no client secret, authorization-code
 * + PKCE (S256) + refresh; consent is always required. Grants/codes/consents
 * use the framework's in-process stores: outstanding AS grants are
 * process-local (a restart re-arms the dance), while the durable session
 * contract remains the MIG-030 refresh-grant table.</p>
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
public class AuthorizationServerConfig {

    /**
     * The AS filter chain: matches ONLY the Spring Authorization Server
     * endpoint set and runs before the API chain. The resource owner
     * authenticates with the ordinary MIG-030 Bearer access token, verified
     * by a {@link BearerTokenAuthenticationFilter} positioned explicitly
     * BEFORE the authorization endpoint filter — the endpoint provider
     * resolves the resource owner from the security context, and the DSL's
     * default resource-server position runs after it (verified via security
     * TRACE: with the DSL order the provider defers and the request falls
     * through unhandled). Status enforcement stays on the shared converter,
     * so inactive or suspended identities are denied at the AS exactly as on
     * every protected REST path (fail-closed at both roles). Unauthenticated
     * and denied requests answer the frozen centralized 401/403 JSON bodies
     * (API clients; browser UX is MIG-034 scope). CSRF is disabled on this
     * chain — every authentication on it is token- or PKCE-bound, never
     * cookie-authenticated (same rationale as the API chain).
     */
    @Bean
    @Order(1)
    public SecurityFilterChain authorizationServerSecurityFilterChain(
            HttpSecurity http,
            JwtTokenService tokenService,
            BearerTokenAuthenticationConverter bearerConverter,
            RegisteredClientRepository registeredClientRepository,
            AuthenticationEntryPoint authenticationEntryPoint,
            AccessDeniedHandler accessDeniedHandler) throws Exception {
        OAuth2AuthorizationServerConfigurer authorizationServer =
                new OAuth2AuthorizationServerConfigurer();
        JwtAuthenticationProvider resourceOwnerProvider =
                new JwtAuthenticationProvider(tokenService.jwtDecoder());
        resourceOwnerProvider.setJwtAuthenticationConverter(bearerConverter);
        BearerTokenAuthenticationFilter resourceOwnerAuthFilter =
                new BearerTokenAuthenticationFilter(new ProviderManager(resourceOwnerProvider));
        resourceOwnerAuthFilter.setAuthenticationFailureHandler(
                (request, response, exception) -> authenticationEntryPoint
                        .commence(request, response, exception));
        http
                .securityMatcher(authorizationServer.getEndpointsMatcher())
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Registered BEFORE the AS configurer's own HTML rule so the
                // frozen JSON entry point wins for every denied request.
                .exceptionHandling(ex -> ex
                        .defaultAuthenticationEntryPointFor(authenticationEntryPoint,
                                AnyRequestMatcher.INSTANCE)
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .addFilterAfter(resourceOwnerAuthFilter, HeaderWriterFilter.class)
                .with(authorizationServer, as -> as
                        .clientAuthentication(clientAuthentication -> clientAuthentication
                                .authenticationConverter(clientAuthenticationConverter())
                                .authenticationProvider(new AsPublicClientAuthenticationProvider(
                                        registeredClientRepository)))
                        .oidc(oidcConfigurer()))
                .authorizeHttpRequests(authorize -> authorize.anyRequest().authenticated());
        return http.build();
    }

    /**
     * AS endpoint metadata: the issuer drives discovery, token stamps and
     * issuer validation. Config-driven ({@code yacc.auth.as.issuer}); the
     * endpoint paths keep the framework defaults.
     */
    @Bean
    public AuthorizationServerSettings authorizationServerSettings(AuthProperties properties) {
        return AuthorizationServerSettings.builder()
                .issuer(properties.as().issuer())
                .build();
    }

    /**
     * The signing JWK source: the SAME RS256 key the resource server uses —
     * one token format, one signing-key source (MIG-033 guardrail; the
     * MIG-030 key is the foundation ADR-025 fixed for both roles). The JWKS
     * endpoint publishes only the public half. Rotating the env key
     * ({@code YACC_AUTH_TOKEN_SIGNING_KEY}) rotates AS signing and resource
     * verification together (single source) — covered by the rotation tests.
     */
    @Bean
    public JWKSource<com.nimbusds.jose.proc.SecurityContext> jwkSource(
            JwtTokenService tokenService) {
        return new ImmutableJWKSet<>(new JWKSet(tokenService.signingKey()));
    }

    /**
     * Registered clients from {@code yacc.auth.as.clients.*} (founder-fixed
     * policy: YACC frontend only unless a third-party client is named).
     * Public OIDC SPA clients: authorization-code + refresh, PKCE (S256)
     * mandatory, consent always required; token TTLs reuse the shared
     * {@code yacc.auth.token} policy (single source); refresh tokens rotate
     * on use (MIG-030 {@code SessionService.rotate} parity). Validation is
     * eager and fail-closed: no clients, missing id, missing redirect URI,
     * or a missing {@code openid} scope fails startup.
     */
    @Bean
    public RegisteredClientRepository registeredClientRepository(AuthProperties properties) {
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
        return new InMemoryRegisteredClientRepository(registered);
    }

    /**
     * Claims alignment (guardrail): AS-issued tokens carry the same role and
     * email claims as MIG-030 sign-in tokens (lowercase wire role from the
     * persisted identity — authorities always re-resolve from the database,
     * so the claim stays informational). ID tokens additionally carry the
     * OIDC profile/email claims the granted scopes authorize (OIDC core
     * §5.4) — account status is never a token claim; it is enforced against
     * the database per request.
     */
    @Bean
    public OAuth2TokenCustomizer<JwtEncodingContext> oidcTokenCustomizer() {
        return context -> {
            // The token context principal is the resource-owner
            // authentication; the AuthUser identity rides as its principal.
            Authentication authentication = context.getPrincipal();
            if (!(authentication.getPrincipal() instanceof AuthUser user)) {
                return;
            }
            context.getClaims()
                    .claim(JwtTokenService.CLAIM_ROLE, user.getRole().getLabel())
                    .claim(JwtTokenService.CLAIM_EMAIL, user.getEmail());
            if (OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue())) {
                Set<String> scopes = context.getAuthorizedScopes();
                if (scopes.contains(OidcScopes.PROFILE)) {
                    context.getClaims().claim("name", user.user().getName());
                }
                if (scopes.contains(OidcScopes.EMAIL)) {
                    context.getClaims()
                            .claim("email_verified", user.user().isEmailVerified());
                }
                if (user.isMustChangePassword()) {
                    // Bootstrap/recovery identities: wire-visible forced
                    // state so an OIDC client can react like the REST
                    // AuthSessionResponse does (MIG-034 adaptation surface).
                    context.getClaims().claim("must_change_password", true);
                }
            }
        };
    }

    /**
     * Token generation for the AS: JWT access/ID tokens from the shared
     * JWKSource plus refresh tokens for ALL registered clients — including
     * the public YACC frontend, which the framework's default generator
     * deliberately starves (see {@link AsRefreshTokenGenerator} for the
     * policy rationale and compensating controls).
     */
    @Bean
    public org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator<? extends org.springframework.security.oauth2.core.OAuth2Token> tokenGenerator(
            JWKSource<com.nimbusds.jose.proc.SecurityContext> jwkSource,
            OAuth2TokenCustomizer<JwtEncodingContext> jwtCustomizer) {
        JwtGenerator jwtGenerator = new JwtGenerator(new NimbusJwtEncoder(jwkSource));
        jwtGenerator.setJwtCustomizer(jwtCustomizer);
        OAuth2AccessTokenGenerator accessTokenGenerator = new OAuth2AccessTokenGenerator();
        return new DelegatingOAuth2TokenGenerator(jwtGenerator, accessTokenGenerator,
                new AsRefreshTokenGenerator());
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

    /**
     * Client-authentication converters for the AS. The framework defaults
     * (JWT assertion, basic, post, PKCE public client) plus an extension for
     * the public YACC frontend on the refresh/revocation endpoints, which
     * the framework otherwise refuses to authenticate (OAuth2.0 Security BCP
     * posture — see {@link AsRefreshTokenGenerator}). The extension
     * authenticates the client by its registered id only; the refresh token
     * itself rotates on every use and is worthless to a thief (compensating
     * controls in {@link AsRefreshTokenGenerator}).
     */
    private static AuthenticationConverter clientAuthenticationConverter() {
        return new DelegatingAuthenticationConverter(java.util.List.of(
                new JwtClientAssertionAuthenticationConverter(),
                new ClientSecretBasicAuthenticationConverter(),
                new ClientSecretPostAuthenticationConverter(),
                new PublicClientAuthenticationConverter(),
                AuthorizationServerConfig::convertPublicRefreshOrRevokeClient));
    }

    private static Authentication convertPublicRefreshOrRevokeClient(HttpServletRequest request) {
        String clientId = request.getParameter(OAuth2ParameterNames.CLIENT_ID);
        if (!org.springframework.util.StringUtils.hasText(clientId)
                || request.getParameter(OAuth2ParameterNames.CLIENT_SECRET) != null) {
            return null;
        }
        boolean refreshRequest = "refresh_token"
                .equals(request.getParameter(OAuth2ParameterNames.GRANT_TYPE));
        boolean revokeRequest = "/oauth2/revoke".equals(request.getRequestURI());
        if (!refreshRequest && !revokeRequest) {
            return null;
        }
        // Non-code-grant additional parameters: tells the framework's
        // code-verifier authenticator this dance carries no authorization
        // code, so only the registered client id authenticates here.
        return new OAuth2ClientAuthenticationToken(clientId,
                ClientAuthenticationMethod.NONE, null, java.util.Map.of());
    }

    private static Customizer<OidcConfigurer> oidcConfigurer() {
        return oidc -> oidc.userInfoEndpoint(userInfo -> userInfo
                .userInfoMapper(AuthorizationServerConfig::oidcUserInfo));
    }

    /**
     * Standard OIDC UserInfo claim mapping (OIDC core §5.3), sourced from
     * the authorization's ID token and filtered by the granted scopes:
     * {@code sub} always, {@code email}/{@code email_verified} under the
     * email scope, {@code name} under the profile scope, plus the YACC
     * {@code role} authorization claim.
     */
    private static OidcUserInfo oidcUserInfo(OidcUserInfoAuthenticationContext context) {
        OAuth2Authorization authorization = context.getAuthorization();
        OidcIdToken idToken = authorization
                .getToken(OidcIdToken.class)
                .getToken();
        Set<String> scopes = authorization.getAuthorizedScopes();
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("sub", idToken.getSubject());
        if (scopes.contains(OidcScopes.EMAIL)) {
            claims.put("email", idToken.getClaimAsString("email"));
            claims.put("email_verified", idToken.getClaimAsBoolean("email_verified"));
        }
        if (scopes.contains(OidcScopes.PROFILE)) {
            claims.put("name", idToken.getClaimAsString("name"));
        }
        String role = idToken.getClaimAsString(JwtTokenService.CLAIM_ROLE);
        if (role != null) {
            claims.put(JwtTokenService.CLAIM_ROLE, role);
        }
        return OidcUserInfo.builder().claims(map -> map.putAll(claims)).build();
    }
}
