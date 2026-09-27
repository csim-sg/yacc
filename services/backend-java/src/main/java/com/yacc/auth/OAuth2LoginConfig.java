package com.yacc.auth;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.model.YaccOidcUser;
import com.yacc.auth.service.JwtTokenService;
import com.yacc.auth.service.OidcIdentityService;
import com.yacc.auth.service.SessionService;
import com.yacc.auth.service.YaccOidcUserService;

/**
 * OIDC relying-party beans (MIG-032; ADR-025 RP role; ARCH-004 §4/§8).
 * Present only when {@code yacc.auth.oauth2.enabled=true} — with the flag off
 * (the default) no RP bean exists and {@code AuthSecurityConfig} builds the
 * same filter chain as before the RP existed (byte-identical behavior).
 *
 * <p>Client registrations are config-driven through the typed
 * {@code yacc.auth.oauth2.registrations.*} properties — no IdP is hard-coded;
 * the founder names the external IdP(s) at acceptance and each binds purely
 * through configuration with secrets from the environment / K8s Secrets.
 * Validation is eager and fail-closed: enabling without at least one complete
 * registration fails startup.</p>
 *
 * <p>The RP wire surface is {@code /api/auth/oidc/**}: the login entry
 * {@code /api/auth/oidc/authorization/{registrationId}} (permitAll) and the
 * RP callback {@code /api/auth/oidc/callback/{registrationId}} (the
 * {@code oauth2Login} processing URL; the redirect URI template below is what
 * the IdP must whitelist).</p>
 */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(prefix = "yacc.auth.oauth2", name = "enabled", havingValue = "true")
public class OAuth2LoginConfig {

    /** Authorization-request base URI (login entry links). */
    public static final String AUTHORIZATION_ENDPOINT_BASE_URI = "/api/auth/oidc/authorization";

    /** RP callback base URI (the IdP redirects back here). */
    public static final String CALLBACK_BASE_URI = "/api/auth/oidc/callback";

    /** The permitAll public surface of the RP. */
    public static final String PUBLIC_MATCHER = "/api/auth/oidc/**";

    /**
     * Redirect URI template handed to the IdP (expanded by Spring Security
     * with the request's base URL and the registration id).
     */
    private static final String REDIRECT_URI_TEMPLATE = "{baseUrl}" + CALLBACK_BASE_URI
            + "/{registrationId}";

    /**
     * Builds the config-driven client registrations. Fail-closed: missing or
     * blank required material for any registration fails startup.
     *
     * @param properties the typed {@code yacc.auth.*} binding
     * @return an immutable repository over the configured registrations
     */
    @Bean
    public ClientRegistrationRepository clientRegistrationRepository(AuthProperties properties) {
        AuthProperties.OAuth2 oauth2 = properties.oauth2();
        Map<String, AuthProperties.OAuth2.Registration> registrations = oauth2.registrations();
        if (registrations == null || registrations.isEmpty()) {
            throw new IllegalStateException(
                    "yacc.auth.oauth2 is enabled but no registrations are configured");
        }
        List<ClientRegistration> built = new ArrayList<>();
        for (Map.Entry<String, AuthProperties.OAuth2.Registration> entry : registrations.entrySet()) {
            built.add(clientRegistration(entry.getKey(), entry.getValue()));
        }
        return new InMemoryClientRegistrationRepository(built.toArray(ClientRegistration[]::new));
    }

    /**
     * The RP identity-resolution seam: loads the external OIDC identity with
     * Spring Security's default {@link OidcUserService} (standard ID-token
     * signature/issuer/audience validation, optional user-info fetch), then
     * resolves the explicitly linked YACC identity.
     *
     * @param identities the linking/provisioning service
     * @return the user service wired into the {@code oauth2Login} segment
     */
    @Bean
    public OAuth2UserService<OidcUserRequest, OidcUser> yaccOidcUserService(
            OidcIdentityService identities) {
        return new YaccOidcUserService(identities);
    }

    /**
     * Completes a successful RP login with the canonical YACC session
     * contract (refresh grant + RS256 access token).
     */
    @Bean
    public AuthenticationSuccessHandler oidcLoginSuccessHandler(SessionService sessions,
            JwtTokenService tokens, ObjectMapper mapper) {
        return new OidcLoginSuccessHandler(sessions, tokens, mapper);
    }

    /**
     * Denies a failed RP login with the canonical frozen 401 body.
     */
    @Bean
    public AuthenticationFailureHandler oidcLoginFailureHandler(ObjectMapper mapper) {
        return new OidcLoginFailureHandler(mapper);
    }

    private static ClientRegistration clientRegistration(String registrationId,
            AuthProperties.OAuth2.Registration registration) {
        if (registrationId == null || registrationId.isBlank()) {
            throw new IllegalStateException("yacc.auth.oauth2.registrations contains a blank id");
        }
        String prefix = "yacc.auth.oauth2.registrations." + registrationId;
        requireNonNull(prefix + ".client-id", registration.clientId());
        requireNonNull(prefix + ".client-secret", registration.clientSecret());
        requireNonNull(prefix + ".authorization-uri", registration.authorizationUri());
        requireNonNull(prefix + ".token-uri", registration.tokenUri());
        requireNonNull(prefix + ".jwk-set-uri", registration.jwkSetUri());

        ClientRegistration.Builder builder = ClientRegistration.withRegistrationId(registrationId)
                .clientId(registration.clientId())
                .clientSecret(registration.clientSecret())
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(REDIRECT_URI_TEMPLATE)
                .authorizationUri(registration.authorizationUri())
                .tokenUri(registration.tokenUri())
                .jwkSetUri(registration.jwkSetUri())
                .issuerUri(registration.issuerUri())
                .userInfoUri(registration.userInfoUri())
                .userNameAttributeName(registration.userNameAttribute() == null
                        ? AuthProperties.OAuth2.DEFAULT_USER_NAME_ATTRIBUTE
                        : registration.userNameAttribute());
        List<String> scopes = registration.scopes() == null || registration.scopes().isEmpty()
                ? AuthProperties.OAuth2.DEFAULT_SCOPES
                : registration.scopes();
        builder.scope(scopes);
        return builder.build();
    }

    private static void requireNonNull(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(name + " is required when yacc.auth.oauth2 is enabled");
        }
    }
}
