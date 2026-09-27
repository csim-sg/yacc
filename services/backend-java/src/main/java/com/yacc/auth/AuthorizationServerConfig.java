package com.yacc.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.authorization.InMemoryOAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.config.annotation.web.configurers.OAuth2AuthorizationServerConfigurer;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.DelegatingOAuth2TokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.JwtGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2AccessTokenGenerator;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationProvider;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.header.HeaderWriterFilter;
import org.springframework.security.web.util.matcher.AnyRequestMatcher;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.yacc.auth.service.BearerTokenAuthenticationConverter;
import com.yacc.auth.service.JwtTokenService;

/**
 * Embedded OIDC authorization server — the ONE AS configuration entry point
 * (MIG-033; ADR-025 AS role; ARCH-004 §8). This class is WIRING ONLY
 * (review loop 1): the security-critical policy/projection/converter
 * responsibilities live in focused constructor-injected auth components —
 * {@link AsClientPolicy} (registered-client policy), {@link AsOidcTokenCustomizer}
 * (JWT claim policy), {@link AsUserInfoProjection} (UserInfo projection),
 * {@link AsClientAuthenticationConverter} (client-request conversion) and
 * {@link AsRefreshTokenSerializationFilter} (per-token refresh serialization).
 *
 * <p>The founder-fixed dual-role OIDC posture: YACC is both relying party
 * (MIG-032) and authorization server — the AS is embedded in the single
 * backend via Spring Authorization Server; no Keycloak/broker (ADR-025).</p>
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
 * <p>Grants/codes/consents use the framework's in-process stores:
 * outstanding AS grants are process-local (a restart re-arms the dance),
 * while the durable session contract remains the MIG-030 refresh-grant
 * table.</p>
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
     *
     * <p>Review loop 1: refresh-grant requests additionally pass through the
     * {@link AsRefreshTokenSerializationFilter} positioned immediately
     * before the {@link AuthorizationFilter} — Spring Authorization Server
     * registers its token endpoint filter AFTER the {@link AuthorizationFilter},
     * so the complete refresh operation (client authentication → grant
     * find/consume → successor save → response) runs inside the per-token
     * lock and a concurrent replay deterministically answers
     * {@code invalid_grant}.</p>
     */
    @Bean
    @Order(1)
    public SecurityFilterChain authorizationServerSecurityFilterChain(
            HttpSecurity http,
            JwtTokenService tokenService,
            BearerTokenAuthenticationConverter bearerConverter,
            AsClientAuthenticationConverter clientAuthenticationConverter,
            AsRefreshTokenSerializationFilter refreshTokenSerializationFilter,
            RegisteredClientRepository registeredClientRepository,
            AsUserInfoProjection userInfoProjection,
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
                // Review loop 1: serialize the complete refresh-grant
                // operation per presented token (race-safe rotation).
                .addFilterBefore(refreshTokenSerializationFilter,
                        AuthorizationFilter.class)
                .with(authorizationServer, as -> as
                        .clientAuthentication(clientAuthentication -> clientAuthentication
                                .authenticationConverter(clientAuthenticationConverter)
                                .authenticationProvider(new AsPublicClientAuthenticationProvider(
                                        registeredClientRepository)))
                        .oidc(oidc -> oidc.userInfoEndpoint(userInfo -> userInfo
                                .userInfoMapper(userInfoProjection))))
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
     * Token generation for the AS: JWT access/ID tokens from the shared
     * JWKSource plus refresh tokens for ALL registered clients — including
     * the public YACC frontend, which the framework's default generator
     * deliberately starves (see {@link AsRefreshTokenGenerator} for the
     * policy rationale and compensating controls).
     */
    @Bean
    public OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator(
            JWKSource<com.nimbusds.jose.proc.SecurityContext> jwkSource,
            AsOidcTokenCustomizer jwtCustomizer) {
        JwtGenerator jwtGenerator = new JwtGenerator(new NimbusJwtEncoder(jwkSource));
        jwtGenerator.setJwtCustomizer(jwtCustomizer);
        OAuth2AccessTokenGenerator accessTokenGenerator = new OAuth2AccessTokenGenerator();
        return new DelegatingOAuth2TokenGenerator(jwtGenerator, accessTokenGenerator,
                new AsRefreshTokenGenerator());
    }

    /**
     * The per-token refresh serialization (review loop 1): a plain filter
     * bean — deliberately NOT a {@code @Component}, so Spring Boot never
     * registers it on the global servlet filter chain (same pattern as
     * {@code ForcedPasswordChangeFilter}); it is wired into the AS chain
     * only.
     */
    @Bean
    public AsRefreshTokenSerializationFilter refreshTokenSerializationFilter() {
        return new AsRefreshTokenSerializationFilter();
    }

    /**
     * The AS grant store wrapped in per-resolution account-status
     * enforcement (MIG-033 guardrail — suspended/revoked accounts are
     * denied at BOTH AS and resource-server roles): a refresh or revocation
     * request carries no bearer token, so every grant resolution re-loads
     * the stored authorization's owner from the database and resolves the
     * grant to {@code null} unless the owner is {@code ACTIVE}. The AS
     * configurers discover this bean automatically; the in-process store
     * itself stays the framework default (KISS).
     */
    @Bean
    public OAuth2AuthorizationService authorizationService(
            com.yacc.auth.service.TokenAuthenticationService tokenAuthenticationService) {
        return new AsStatusEnforcingAuthorizationService(
                new InMemoryOAuth2AuthorizationService(), tokenAuthenticationService);
    }
}
