package com.yacc.auth;

import java.util.Set;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.stereotype.Component;

import com.yacc.auth.model.AuthUser;
import com.yacc.auth.service.JwtTokenService;

/**
 * JWT claim policy for AS-issued tokens (MIG-033; guardrail: claims
 * alignment) — split out of the AS configuration (review loop 1:
 * configuration stays wiring, claim policy lives here).
 *
 * <p>AS-issued tokens carry the same role and email claims as MIG-030
 * sign-in tokens (lowercase wire role from the persisted identity —
 * authorities always re-resolve from the database, so the claim stays
 * informational). ID tokens additionally carry the OIDC profile/email
 * claims the granted scopes authorize (OIDC core §5.4) — account status is
 * never a token claim; it is enforced against the database per request.</p>
 */
@Component
public class AsOidcTokenCustomizer implements OAuth2TokenCustomizer<JwtEncodingContext> {

    @Override
    public void customize(JwtEncodingContext context) {
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
    }
}
