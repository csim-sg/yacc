package com.yacc.auth;

import java.io.IOException;
import java.util.concurrent.locks.ReentrantLock;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.util.StringUtils;

/**
 * Serializes the complete refresh-grant operation per presented refresh
 * token (MIG-033 review loop 1; ADR-025 AS role).
 *
 * <p>Spring Authorization Server's refresh provider performs
 * {@code findByToken} → active check → successor generation → {@code save}
 * as separate steps against the process-local authorization store. Without
 * serialization, two concurrent requests carrying the SAME rotation-on-use
 * token can both observe the still-active grant and both issue successors —
 * rotation would not provide single-use replay protection under a race.
 * This filter holds a striped lock keyed by the presented token value for
 * the WHOLE downstream chain, so the replaying request runs only after the
 * first request fully consumed the grant; the framework then answers the
 * replay with {@code invalid_grant} — exactly one success per presented
 * token, for ANY interleaving (deterministic outcome, no timing window).</p>
 *
 * <p>Striped locks (fixed 64 buckets keyed by token hash) bound memory with
 * no eviction path; only refresh requests with a presented token are ever
 * locked. Single-instance deployment (ADR-025) makes in-process
 * serialization sufficient. Registered as an AS-chain bean — deliberately
 * NOT a {@code @Component}, so Spring Boot never adds it to the global
 * servlet filter chain (same pattern as {@code ForcedPasswordChangeFilter}).</p>
 */
public class AsRefreshTokenSerializationFilter implements Filter {

    private static final int STRIPES = 64;

    private final ReentrantLock[] stripes;

    /** Constructor injection only (guardrails 004 §2; ADR-024; ADR-030). */
    public AsRefreshTokenSerializationFilter() {
        ReentrantLock[] locks = new ReentrantLock[STRIPES];
        for (int i = 0; i < STRIPES; i++) {
            locks[i] = new ReentrantLock();
        }
        this.stripes = locks;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response,
            FilterChain chain) throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest httpRequest)
                || !(response instanceof HttpServletResponse httpResponse)) {
            chain.doFilter(request, response);
            return;
        }
        String presented = presentedRefreshToken(httpRequest);
        if (presented == null) {
            chain.doFilter(request, response);
            return;
        }
        ReentrantLock lock =
                this.stripes[Math.floorMod(presented.hashCode(), STRIPES)];
        lock.lock();
        try {
            chain.doFilter(request, response);
        } finally {
            lock.unlock();
        }
    }

    /**
     * The presented refresh token of a refresh-grant request, or
     * {@code null} for anything else (never locked: other grants,
     * non-POST probes, malformed requests without a token value).
     */
    private String presentedRefreshToken(HttpServletRequest request) {
        if (!"POST".equals(request.getMethod())
                || !"refresh_token".equals(
                        request.getParameter(OAuth2ParameterNames.GRANT_TYPE))) {
            return null;
        }
        String token = request.getParameter(OAuth2ParameterNames.REFRESH_TOKEN);
        return StringUtils.hasText(token) ? token : null;
    }
}
