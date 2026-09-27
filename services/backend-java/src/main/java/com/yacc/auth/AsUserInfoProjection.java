package com.yacc.auth;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.oidc.authentication.OidcUserInfoAuthenticationContext;
import org.springframework.stereotype.Component;

import com.yacc.auth.service.JwtTokenService;

/**
 * Standard OIDC UserInfo claim projection (MIG-033; OIDC core §5.3) —
 * split out of the AS configuration (review loop 1: configuration stays
 * wiring, the projection policy lives here).
 *
 * <p>Sourced from the authorization's ID token and filtered by the granted
 * scopes: {@code sub} always, {@code email}/{@code email_verified} under
 * the email scope, {@code name} under the profile scope, plus the YACC
 * {@code role} authorization claim.</p>
 */
@Component
public class AsUserInfoProjection
        implements Function<OidcUserInfoAuthenticationContext, OidcUserInfo> {

    @Override
    public OidcUserInfo apply(OidcUserInfoAuthenticationContext context) {
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
