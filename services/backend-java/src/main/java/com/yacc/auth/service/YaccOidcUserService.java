package com.yacc.auth.service;

import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

import com.yacc.auth.model.User;
import com.yacc.auth.model.YaccOidcUser;

/**
 * The OIDC relying-party identity-resolution seam (MIG-032; TR-05). Loads the
 * external IdP identity with Spring Security's default {@link OidcUserService}
 * — standard ID-token signature (JWKS), issuer, audience, and timestamp
 * validation, plus the optional user-info fetch — then resolves the YACC
 * identity through {@link OidcIdentityService} (explicit account linking,
 * {@code USER}-only provisioning, {@code ACTIVE}-status enforcement) and
 * returns it as the authenticated {@link YaccOidcUser} principal.
 *
 * <p>Resolution runs inside authentication: a denied identity throws before
 * any success is finalized, so the published security event — and therefore
 * the audit trail — stays truthful (deny ≠ login).</p>
 */
public class YaccOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

    private final OidcUserService delegate = new OidcUserService();

    private final OidcIdentityService identities;

    public YaccOidcUserService(OidcIdentityService identities) {
        this.identities = identities;
    }

    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) {
        OidcUser external = delegate.loadUser(userRequest);
        User user = identities.resolve(
                userRequest.getClientRegistration().getRegistrationId(), external);
        return new YaccOidcUser(user, external);
    }
}
