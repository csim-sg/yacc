package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.io.IOException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.ServletException;

/**
 * Unit tests for the password-reset rate limiter (MIG-031; ledger row
 * REST-XSRV-003 policy parity with the POC {@code passwordResetRateLimiter}):
 * 3 requests per hour per IP, fourth request answered 429 with the frozen
 * {@code {error}} shape, other addresses unaffected, OPTIONS and
 * non-reset paths skipped.
 */
class PasswordResetRateLimitFilterTest {

    private PasswordResetRateLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new PasswordResetRateLimitFilter(new ObjectMapper());
    }

    private MockHttpServletRequest post(String uri, String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", uri);
        request.setRemoteAddr(remoteAddr);
        return request;
    }

    private MockHttpServletResponse passThrough(MockHttpServletRequest request)
            throws ServletException, IOException {
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }

    @Test
    void allowsThreeRequestsPerWindowAndRejectsTheFourth() throws Exception {
        String ip = "203.0.113.10";
        for (int i = 0; i < 3; i++) {
            assertThat(passThrough(post("/api/auth/forgot-password", ip)).getStatus())
                    .isEqualTo(200);
        }

        MockHttpServletResponse fourth =
                passThrough(post("/api/auth/forgot-password", ip));

        assertThat(fourth.getStatus()).isEqualTo(429);
        assertThat(fourth.getContentAsString())
                .contains("Too many password reset attempts. Please try again in 1 hour.");
        assertThat(fourth.getHeader("RateLimit-Limit")).isEqualTo("3");
        assertThat(fourth.getHeader("RateLimit-Remaining")).isEqualTo("0");
    }

    @Test
    void countsForgotAndPasswordResetAgainstTheSamePolicy() throws Exception {
        String ip = "203.0.113.11";
        assertThat(passThrough(post("/api/auth/forgot-password", ip)).getStatus()).isEqualTo(200);
        assertThat(passThrough(post("/api/auth/forgot-password", ip)).getStatus()).isEqualTo(200);
        assertThat(passThrough(post("/api/auth/reset-password", ip)).getStatus()).isEqualTo(200);

        assertThat(passThrough(post("/api/auth/reset-password", ip)).getStatus())
                .isEqualTo(429);
    }

    @Test
    void otherAddressesKeepTheirOwnBudget() throws Exception {
        assertThat(passThrough(post("/api/auth/forgot-password", "203.0.113.12"))
                .getStatus()).isEqualTo(200);
        assertThat(passThrough(post("/api/auth/forgot-password", "203.0.113.12"))
                .getStatus()).isEqualTo(200);
        assertThat(passThrough(post("/api/auth/forgot-password", "203.0.113.12"))
                .getStatus()).isEqualTo(200);
        assertThat(passThrough(post("/api/auth/forgot-password", "203.0.113.12"))
                .getStatus()).isEqualTo(429);

        // A different address is untouched by the first address's window.
        assertThat(passThrough(post("/api/auth/forgot-password", "203.0.113.99"))
                .getStatus()).isEqualTo(200);
    }

    @Test
    void nonResetPathsAndOptionsAreNeverLimited() throws Exception {
        MockHttpServletRequest options =
                new MockHttpServletRequest("OPTIONS", "/api/auth/forgot-password");
        options.setRemoteAddr("203.0.113.13");
        MockHttpServletResponse response = new MockHttpServletResponse();
        jakarta.servlet.FilterChain chain = Mockito.mock(jakarta.servlet.FilterChain.class);

        filter.doFilter(options, response, chain);

        verify(chain).doFilter(options, response);
        // The sign-in surface is explicitly out of the MIG-031 limiter scope
        // (login rate limiting stays ledger row REST-XSRV-003 follow-up).
        MockHttpServletRequest signIn =
                new MockHttpServletRequest("POST", "/api/auth/sign-in/email");
        signIn.setRemoteAddr("203.0.113.13");
        for (int i = 0; i < 10; i++) {
            assertThat(passThrough(signIn).getStatus()).isEqualTo(200);
        }
    }

    @Test
    void limitedRequestsShortCircuitTheChain() throws Exception {
        String ip = "203.0.113.14";
        for (int i = 0; i < 4; i++) {
            passThrough(post("/api/auth/reset-password", ip));
        }
        MockHttpServletRequest fifth = post("/api/auth/reset-password", ip);
        MockHttpServletResponse response = new MockHttpServletResponse();
        jakarta.servlet.FilterChain chain = Mockito.mock(jakarta.servlet.FilterChain.class);

        filter.doFilter(fifth, response, chain);

        verify(chain, never()).doFilter(fifth, response);
    }
}
