package com.yacc.auth.service;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;

import com.yacc.auth.model.AuthUser;

/**
 * Maps a verified inbound Bearer JWT to an authenticated token
 * (MIG-030; ADR-025 resource-server policy).
 *
 * <p>Status enforcement and authority mapping happen here per request via
 * {@link TokenAuthenticationService} — authorities always reflect the current
 * persisted role, and a token presented by an identity that has since become
 * inactive or suspended is rejected (401). Wired as a bean by
 * {@code AuthSecurityConfig} (not component-scanned, so web-layer test
 * slices stay DB-free).</p>
 */
public class BearerTokenAuthenticationConverter
        implements Converter<Jwt, AbstractAuthenticationToken> {

    private final TokenAuthenticationService authenticator;

    public BearerTokenAuthenticationConverter(TokenAuthenticationService authenticator) {
        this.authenticator = authenticator;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt accessToken) {
        AuthUser user = authenticator.authenticate(accessToken);
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
        // The presented token rides as details so auth endpoints can read its
        // claims (e.g. sign-out revokes the refresh grant named by `sid`).
        authentication.setDetails(accessToken);
        return authentication;
    }
}
