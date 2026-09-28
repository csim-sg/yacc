package com.yacc.realtime.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import com.yacc.auth.model.AuthUser;
import com.yacc.auth.service.JwtTokenService;
import com.yacc.auth.service.TokenAuthenticationService;
import com.yacc.realtime.model.RealtimeSession;

/**
 * Auth-on-handshake for the raw WebSocket endpoint (MIG-050; ledger
 * WS-BHV-016; ADR-025/026). Reuses the single auth seam —
 * {@link JwtTokenService} token verification plus
 * {@link TokenAuthenticationService} status enforcement — so an upgrade is
 * denied for exactly the same reasons a REST request would be: missing,
 * invalid, or expired token, or an inactive/suspended identity. There is no
 * unauthenticated upgrade.
 *
 * <p>The access token travels in the {@code token} query parameter of the
 * upgrade request (the raw-WebSocket equivalent of the baseline Socket.io
 * {@code handshake.auth.token} — browsers cannot set an Authorization header
 * on an upgrade). On success the {@link RealtimeSession} identity is attached
 * as a handshake attribute before session establishment.</p>
 */
@Component
public class WebSocketHandshakeAuthInterceptor implements HandshakeInterceptor {

    /** Upgrade-request query parameter carrying the access token. */
    public static final String TOKEN_PARAMETER = "token";

    /** Handshake attribute holding the authenticated {@link RealtimeSession}. */
    public static final String IDENTITY_ATTRIBUTE = "yacc.realtime.identity";

    private final JwtTokenService tokenService;

    private final TokenAuthenticationService authenticator;

    public WebSocketHandshakeAuthInterceptor(JwtTokenService tokenService,
            TokenAuthenticationService authenticator) {
        this.tokenService = tokenService;
        this.authenticator = authenticator;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
            WebSocketHandler wsHandler, java.util.Map<String, Object> attributes) {
        String token = tokenOf(request);
        if (token == null || token.isBlank()) {
            return deny(response);
        }
        try {
            Jwt accessToken = tokenService.decodeAccessToken(token);
            AuthUser user = authenticator.authenticate(accessToken);
            attributes.put(IDENTITY_ATTRIBUTE, new RealtimeSession(
                    null, // session id is assigned by the transport after upgrade
                    user.getId(),
                    user.getEmail(),
                    user.getRole().getLabel(),
                    user.user().getName()));
            return true;
        } catch (org.springframework.security.oauth2.jwt.JwtException
                | InvalidBearerTokenException e) {
            // JwtException covers every decoder failure shape (validation,
            // malformed) — all deny with 401, never 500.
            return deny(response);
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
            WebSocketHandler wsHandler, Exception exception) {
        // No handshake teardown needed.
    }

    private static String tokenOf(ServerHttpRequest request) {
        return org.springframework.web.util.UriComponentsBuilder.fromUri(request.getURI())
                .build()
                .getQueryParams()
                .getFirst(TOKEN_PARAMETER);
    }

    private static boolean deny(ServerHttpResponse response) {
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        return false;
    }
}
