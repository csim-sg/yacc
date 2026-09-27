package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;

/**
 * Unit tests for the AS client-request conversion (MIG-033; review loop 1
 * split): the public-client extension authenticates refresh/revocation
 * requests by registered id only, while PKCE code exchanges stay with the
 * framework's provider (a failed code-verifier check can never be bypassed
 * here — the empty-additional-parameters guard).
 */
class AsClientAuthenticationConverterTest {

    private final AsClientAuthenticationConverter converter =
            new AsClientAuthenticationConverter();

    private MockHttpServletRequest refreshRequest() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/token");
        request.setParameter(OAuth2ParameterNames.GRANT_TYPE, "refresh_token");
        request.setParameter(OAuth2ParameterNames.REFRESH_TOKEN, "presented-token");
        request.setParameter(OAuth2ParameterNames.CLIENT_ID, "yacc-frontend");
        return request;
    }

    @Test
    void publicRefreshRequestAuthenticatesByRegisteredClientIdOnly() {
        Authentication authentication = this.converter.convert(refreshRequest());

        assertThat(authentication).isInstanceOf(OAuth2ClientAuthenticationToken.class);
        OAuth2ClientAuthenticationToken token = (OAuth2ClientAuthenticationToken) authentication;
        assertThat(token.getPrincipal()).isEqualTo("yacc-frontend");
        assertThat(token.getClientAuthenticationMethod())
                .isEqualTo(ClientAuthenticationMethod.NONE);
        // The empty-additional-parameters guard: no authorization code rides
        // this authentication, so the framework's code-verifier check is the
        // only path for PKCE exchanges.
        assertThat(token.getAdditionalParameters()).isEmpty();
    }

    @Test
    void revocationRequestAuthenticatesByRegisteredClientIdOnly() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/revoke");
        request.setParameter(OAuth2ParameterNames.TOKEN, "presented-token");
        request.setParameter(OAuth2ParameterNames.CLIENT_ID, "yacc-frontend");

        Authentication authentication = this.converter.convert(request);

        assertThat(authentication).isInstanceOf(OAuth2ClientAuthenticationToken.class);
        assertThat(((OAuth2ClientAuthenticationToken) authentication).getPrincipal())
                .isEqualTo("yacc-frontend");
    }

    @Test
    void authorizationCodeExchangesRideTheFrameworkPkcePath() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/token");
        request.setParameter(OAuth2ParameterNames.GRANT_TYPE, "authorization_code");
        request.setParameter(OAuth2ParameterNames.CODE, "any-code");
        request.setParameter(OAuth2ParameterNames.CLIENT_ID, "yacc-frontend");
        request.setParameter("code_verifier", "verifier");

        Authentication authentication = this.converter.convert(request);

        // The framework's PublicClientAuthenticationConverter converts the
        // exchange with the verifier as an additional parameter — the
        // code-verifier check stays on the framework's provider and can
        // never be routed through this assembly's empty-parameter extension.
        assertThat(authentication).isInstanceOf(OAuth2ClientAuthenticationToken.class);
        assertThat(((OAuth2ClientAuthenticationToken) authentication)
                .getAdditionalParameters()).containsKey("code_verifier");
    }

    @Test
    void confidentialClientHintsTakeTheFrameworkSecretPath() {
        MockHttpServletRequest request = refreshRequest();
        request.setParameter(OAuth2ParameterNames.CLIENT_SECRET, "leaked-secret");

        Authentication authentication = this.converter.convert(request);

        // A client secret is converted by the framework's secret converter —
        // never mistaken for the public-client extension.
        assertThat(authentication).isInstanceOf(OAuth2ClientAuthenticationToken.class);
        assertThat(((OAuth2ClientAuthenticationToken) authentication)
                .getClientAuthenticationMethod())
                .isEqualTo(ClientAuthenticationMethod.CLIENT_SECRET_POST);
    }

    @Test
    void requestWithoutClientIdIsNotConverted() {
        MockHttpServletRequest request = refreshRequest();
        request.removeParameter(OAuth2ParameterNames.CLIENT_ID);

        assertThat(this.converter.convert(request)).isNull();
    }

    @Test
    void unrelatedGrantTypesAreNotConverted() {
        MockHttpServletRequest request = refreshRequest();
        request.setParameter(OAuth2ParameterNames.GRANT_TYPE, "client_credentials");

        assertThat(this.converter.convert(request)).isNull();
    }
}
