package com.yacc.auth;

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
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

import com.yacc.auth.service.BearerTokenAuthenticationConverter;
import com.yacc.auth.service.JwtTokenService;
import com.yacc.auth.service.TokenAuthenticationService;
import com.yacc.auth.service.YaccUserDetailsService;

/**
 * Spring Security filter chain for the YACC identity subsystem (MIG-030;
 * ADR-025; ARCH-004 §5/§8). Stateless Bearer-JWT resource-server policy:
 *
 * <ul>
 *   <li>public wire surface: health probes, Prometheus scrape, sign-in,
 *       self-registration, refresh-token — everything else requires a valid
 *       access token (deny by default);</li>
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
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class AuthSecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            BearerTokenAuthenticationConverter bearerConverter,
            JwtTokenService tokenService) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/health",
                                "/health/**",
                                "/actuator/health/**",
                                "/actuator/prometheus",
                                "/error",
                                "/api/auth/sign-in/email",
                                "/api/auth/sign-up/email",
                                "/api/auth/refresh-token")
                        .permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .authenticationEntryPoint(new RestAuthenticationEntryPoint())
                        .accessDeniedHandler(new RestAccessDeniedHandler())
                        .jwt(jwt -> jwt
                                .decoder(tokenService.jwtDecoder())
                                .jwtAuthenticationConverter(bearerConverter)))
                .addFilterAfter(new ForcedPasswordChangeFilter(),
                        BearerTokenAuthenticationFilter.class);
        return http.build();
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
