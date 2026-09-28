package com.yacc.auth;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.service.BearerTokenAuthenticationConverter;
import com.yacc.auth.service.JwtTokenService;
import com.yacc.auth.service.TokenAuthenticationService;
import com.yacc.auth.service.YaccUserDetailsService;
import com.yacc.realtime.RealtimeProperties;

/**
 * Spring Security filter chain for the YACC identity subsystem (MIG-030;
 * ADR-025; ARCH-004 §5/§8). Stateless Bearer-JWT resource-server policy:
 *
 * <ul>
 *   <li>public wire surface: health probes, Prometheus scrape, sign-in,
 *       self-registration, refresh-token, plus the MIG-031 token flows
 *       (forgot-password, reset-password, verify-email) — everything else
 *       requires a valid access token (deny by default);</li>
 *   <li>status enforcement per request via
 *       {@link BearerTokenAuthenticationConverter} — inactive/suspended
 *       identities are denied (401) on every protected REST path, and the
 *       same seam backs the raw WebSocket handshake (MIG-050);</li>
 *   <li>forced password change: bootstrap/recovery identities pass
 *       authentication but are denied (403) everything under {@code /api}
 *       outside the auth endpoints until the credential is replaced
 *       ({@link ForcedPasswordChangeFilter});</li>
 *   <li>method security ({@code @PreAuthorize}) is enabled so feature
 *       controllers enforce the RBAC 4-role matrix — no role inheritance,
 *       explicit roles per gate;</li>
 *   <li>no bespoke token crypto, no server-side HTTP session, no CSRF token
 *       (Bearer tokens are not cookie-authenticated).</li>
 * </ul>
 *
 * <p>MIG-032 OIDC relying party (ADR-025 RP role; TR-05): when the RP is
 * enabled in configuration ({@code yacc.auth.oauth2.enabled=true}, see
 * {@link OAuth2LoginConfig}), the chain additionally carries the
 * {@code oauth2Login} segment under {@code /api/auth/oidc/**} — permitAll
 * login/callback entry points backed by config-driven client registrations
 * and explicit account linking. With the RP disabled (the default) the chain
 * is exactly as above; tokenless non-browser requests keep the frozen 401
 * JSON contract in both modes (the resource-server entry point is registered
 * first, so it remains the fallback for non-matched request profiles).</p>
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class AuthSecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            BearerTokenAuthenticationConverter bearerConverter,
            JwtTokenService tokenService,
            RestAuthenticationEntryPoint authenticationEntryPoint,
            RestAccessDeniedHandler accessDeniedHandler,
            ForcedPasswordChangeFilter forcedPasswordChangeFilter,
            PasswordResetRateLimitFilter passwordResetRateLimitFilter,
            RealtimeProperties realtimeProperties,
            ObjectProvider<ClientRegistrationRepository> oidcClientRegistrations,
            ObjectProvider<OAuth2UserService<OidcUserRequest, OidcUser>> oidcUserService,
            ObjectProvider<AuthenticationSuccessHandler> oidcLoginSuccessHandler,
            ObjectProvider<AuthenticationFailureHandler> oidcLoginFailureHandler)
            throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> {
                    authorize.requestMatchers(
                                    "/health",
                                    "/health/**",
                                    "/actuator/health/**",
                                    "/actuator/prometheus",
                                    "/error",
                                    // MIG-050 raw WebSocket upgrade path (ADR-026):
                                    // public at the servlet filter chain because the
                                    // access token arrives as a query parameter on the
                                    // upgrade request (browsers cannot set an
                                    // Authorization header there). The realtime
                                    // handshake interceptor is the auth gate — it
                                    // validates the token and enforces ACTIVE status
                                    // before any session exists (WS-BHV-016), so no
                                    // unauthenticated upgrade is possible.
                                    realtimeProperties.websocket().path(),
                                    "/api/auth/sign-in/email",
                                    "/api/auth/sign-up/email",
                                    "/api/auth/refresh-token",
                                    "/api/auth/forgot-password",
                                    "/api/auth/reset-password",
                                    "/api/auth/verify-email")
                            .permitAll();
                    // MIG-032 RP public surface — present only when the RP is
                    // configured (OAuth2LoginConfig provides the beans).
                    if (oidcClientRegistrations.getIfAvailable() != null) {
                        authorize.requestMatchers(OAuth2LoginConfig.PUBLIC_MATCHER).permitAll();
                    }
                    authorize.anyRequest().authenticated();
                })
                .oauth2ResourceServer(oauth2 -> oauth2
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler)
                        .jwt(jwt -> jwt
                                .decoder(tokenService.jwtDecoder())
                                .jwtAuthenticationConverter(bearerConverter)))
                .addFilterAfter(passwordResetRateLimitFilter,
                        BearerTokenAuthenticationFilter.class)
                .addFilterAfter(forcedPasswordChangeFilter,
                        BearerTokenAuthenticationFilter.class);
        if (oidcClientRegistrations.getIfAvailable() != null) {
            // MIG-032 relying-party segment (ADR-025 RP role): config-driven
            // client registrations, explicit linking in the OIDC user
            // service, canonical session contract on success, frozen 401 on
            // failure. The IdP redirect_uri is
            // {baseUrl}/api/auth/oidc/callback/{registrationId}.
            http.oauth2Login(oauth2 -> oauth2
                    .authorizationEndpoint(authorization -> authorization
                            .baseUri(OAuth2LoginConfig.AUTHORIZATION_ENDPOINT_BASE_URI))
                    .loginProcessingUrl(OAuth2LoginConfig.CALLBACK_BASE_URI + "/{registrationId}")
                    .userInfoEndpoint(userInfo -> userInfo
                            .oidcUserService(oidcUserService.getObject()))
                    .successHandler(oidcLoginSuccessHandler.getObject())
                    .failureHandler(oidcLoginFailureHandler.getObject()));
        }
        return http.build();
    }

    /**
     * Centralized 401 error body, built with the shared Spring
     * {@code ObjectMapper} (constructor injection only — guardrails 004 §2).
     */
    @Bean
    public RestAuthenticationEntryPoint restAuthenticationEntryPoint(
            ObjectMapper objectMapper) {
        return new RestAuthenticationEntryPoint(objectMapper);
    }

    /**
     * Centralized 403 error body, built with the shared Spring
     * {@code ObjectMapper} (constructor injection only — guardrails 004 §2).
     */
    @Bean
    public RestAccessDeniedHandler restAccessDeniedHandler(ObjectMapper objectMapper) {
        return new RestAccessDeniedHandler(objectMapper);
    }

    /**
     * Forced-password-change gate, built with the shared Spring
     * {@code ObjectMapper} (constructor injection only — guardrails 004 §2).
     */
    @Bean
    public ForcedPasswordChangeFilter forcedPasswordChangeFilter(
            ObjectMapper objectMapper) {
        return new ForcedPasswordChangeFilter(objectMapper);
    }

    /**
     * Password-reset rate limiter (MIG-031), built with the shared Spring
     * {@code ObjectMapper} (constructor injection only — guardrails 004 §2).
     */
    @Bean
    public PasswordResetRateLimitFilter passwordResetRateLimitFilter(
            ObjectMapper objectMapper) {
        return new PasswordResetRateLimitFilter(objectMapper);
    }

    /**
     * The JWT → {@code Authentication} translation (concrete bean, not
     * component-scanned, so web-layer test slices stay DB-free).
     */
    @Bean
    public BearerTokenAuthenticationConverter bearerTokenAuthenticationConverter(
            TokenAuthenticationService tokenAuthentication) {
        return new BearerTokenAuthenticationConverter(tokenAuthentication);
    }

    @Bean
    public AuthenticationManager authenticationManager(
            YaccUserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider =
                new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // Standard bcrypt — hash-compatible with the POC's bcryptjs ($2a/$2b).
        return new BCryptPasswordEncoder();
    }
}
