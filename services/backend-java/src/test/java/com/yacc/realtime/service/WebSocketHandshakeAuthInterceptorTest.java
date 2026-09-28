package com.yacc.realtime.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.web.socket.WebSocketHandler;

import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.service.JwtTokenService;
import com.yacc.auth.service.TokenAuthenticationService;
import com.yacc.realtime.model.RealtimeSession;

/**
 * Unit tests for auth-on-handshake (MIG-050; WS-BHV-016; ADR-025 status
 * enforcement parity): the upgrade is refused with 401 unless a valid token
 * names an ACTIVE identity, and the authenticated identity is attached to
 * the handshake attributes before any session exists.
 */
@ExtendWith(MockitoExtension.class)
class WebSocketHandshakeAuthInterceptorTest {

    @Mock
    private JwtTokenService tokenService;

    @Mock
    private TokenAuthenticationService authenticator;

    private WebSocketHandshakeAuthInterceptor interceptor;

    private final ServerHttpRequest request = mock(ServerHttpRequest.class);
    private final ServerHttpResponse response = mock(ServerHttpResponse.class);
    private final Map<String, Object> attributes = new HashMap<>();

    @BeforeEach
    void setUp() {
        interceptor = new WebSocketHandshakeAuthInterceptor(tokenService, authenticator);
    }

    private void requestUri(String query) {
        when(request.getURI())
                .thenReturn(URI.create("http://localhost:8080/ws" + (query == null ? "" : query)));
    }

    private static Jwt accessToken(String subject) {
        return Jwt.withTokenValue("token-" + subject)
                .header("alg", "RS256")
                .subject(subject)
                .build();
    }

    private static AuthUser principal(String id, UserStatus status) {
        User user = new User(id, id + "@fixture.yacc.local", "Fixture " + id,
                "hash", UserRole.USER, status, false);
        return new AuthUser(user);
    }

    @Test
    void validTokenForActiveIdentityAttachesIdentityAndAdmitsTheUpgrade() {
        requestUri("?token=good-token");
        when(tokenService.decodeAccessToken("good-token")).thenReturn(accessToken("user-1"));
        when(authenticator.authenticate(accessToken("user-1")))
                .thenReturn(principal("user-1", UserStatus.ACTIVE));

        boolean admitted = interceptor.beforeHandshake(request, response,
                mock(WebSocketHandler.class), attributes);

        assertThat(admitted).isTrue();
        assertThat(attributes).containsKey(WebSocketHandshakeAuthInterceptor.IDENTITY_ATTRIBUTE);
        RealtimeSession attached = (RealtimeSession) attributes
                .get(WebSocketHandshakeAuthInterceptor.IDENTITY_ATTRIBUTE);
        assertThat(attached.userId()).isEqualTo("user-1");
        assertThat(attached.email()).isEqualTo("user-1@fixture.yacc.local");
        assertThat(attached.role()).isEqualTo("user");
        assertThat(attached.name()).isEqualTo("Fixture user-1");
    }

    @Test
    void missingTokenIsRejectedWith401BeforeAnySessionExists() {
        requestUri("");

        boolean admitted = interceptor.beforeHandshake(request, response,
                mock(WebSocketHandler.class), attributes);

        assertThat(admitted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        assertThat(attributes).isEmpty();
    }

    @Test
    void blankTokenIsRejectedWith401() {
        requestUri("?token=");

        boolean admitted = interceptor.beforeHandshake(request, response,
                mock(WebSocketHandler.class), attributes);

        assertThat(admitted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void invalidSignatureOrExpiredTokenIsRejectedWith401() {
        requestUri("?token=forged");
        when(tokenService.decodeAccessToken("forged"))
                .thenThrow(new JwtException("invalid token"));

        boolean admitted = interceptor.beforeHandshake(request, response,
                mock(WebSocketHandler.class), attributes);

        assertThat(admitted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        assertThat(attributes).isEmpty();
    }

    @Test
    void inactiveIdentityIsRejectedWith401() {
        requestUri("?token=inactive-token");
        when(tokenService.decodeAccessToken("inactive-token")).thenReturn(accessToken("user-2"));
        when(authenticator.authenticate(accessToken("user-2")))
                .thenThrow(new InvalidBearerTokenException("User account is inactive or suspended"));

        boolean admitted = interceptor.beforeHandshake(request, response,
                mock(WebSocketHandler.class), attributes);

        assertThat(admitted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        assertThat(attributes).isEmpty();
    }

    @Test
    void suspendedIdentityIsRejectedWith401() {
        requestUri("?token=suspended-token");
        when(tokenService.decodeAccessToken("suspended-token")).thenReturn(accessToken("user-3"));
        when(authenticator.authenticate(accessToken("user-3")))
                .thenThrow(new InvalidBearerTokenException("User account is inactive or suspended"));

        boolean admitted = interceptor.beforeHandshake(request, response,
                mock(WebSocketHandler.class), attributes);

        assertThat(admitted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unrelatedQueryParametersDoNotAuthenticate() {
        requestUri("?other=value");

        boolean admitted = interceptor.beforeHandshake(request, response,
                mock(WebSocketHandler.class), attributes);

        assertThat(admitted).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void afterHandshakeIsAStatelessNoOp() {
        interceptor.afterHandshake(request, response, mock(WebSocketHandler.class), null);
        // Nothing to assert — the interceptor keeps no per-handshake state.
    }
}
