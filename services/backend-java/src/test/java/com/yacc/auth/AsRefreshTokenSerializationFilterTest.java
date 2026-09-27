package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;

/**
 * Unit tests for the per-token refresh serialization (MIG-033 review loop
 * 1): two requests presenting the SAME refresh token can never execute the
 * downstream refresh-grant operation concurrently — the deterministic
 * single-use replay protection — while every other request passes through
 * unlocked.
 */
class AsRefreshTokenSerializationFilterTest {

    private final AsRefreshTokenSerializationFilter filter =
            new AsRefreshTokenSerializationFilter();

    private MockHttpServletRequest refreshRequest(String token) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/token");
        request.setParameter(OAuth2ParameterNames.GRANT_TYPE, "refresh_token");
        request.setParameter(OAuth2ParameterNames.REFRESH_TOKEN, token);
        request.setParameter(OAuth2ParameterNames.CLIENT_ID, "yacc-frontend");
        return request;
    }

    /**
     * A downstream "refresh operation" that records enter/exit, tracks the
     * peak concurrency, and blocks INSIDE the operation until released —
     * the deterministic stand-in for the framework's
     * find/consume/generate/save sequence.
     */
    private FilterChain blockingOperation(String label, AtomicInteger concurrent,
            AtomicInteger maxConcurrent, List<String> order, CountDownLatch entered,
            CountDownLatch release) {
        return (request, response) -> {
            int now = concurrent.incrementAndGet();
            maxConcurrent.accumulateAndGet(now, Math::max);
            order.add(label + ":enter");
            entered.countDown();
            try {
                if (!release.await(5, TimeUnit.SECONDS)) {
                    order.add(label + ":timeout");
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ServletException(e);
            }
            concurrent.decrementAndGet();
            order.add(label + ":exit");
        };
    }

    @FunctionalInterface
    private interface ThrowingOperation {

        void run() throws Exception;
    }

    private Thread runInThread(ThrowingOperation operation) {
        Thread thread = new Thread(() -> {
            try {
                operation.run();
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        });
        thread.start();
        return thread;
    }

    @Test
    void sameRefreshTokenRequestsRunOneAtATime() throws Exception {
        AtomicInteger concurrent = new AtomicInteger();
        AtomicInteger maxConcurrent = new AtomicInteger();
        List<String> order = new CopyOnWriteArrayList<>();
        CountDownLatch firstEntered = new CountDownLatch(1);
        CountDownLatch firstRelease = new CountDownLatch(1);
        CountDownLatch secondEntered = new CountDownLatch(1);
        CountDownLatch secondRelease = new CountDownLatch(1);

        Thread first = this.runInThread(() -> this.filter.doFilter(
                refreshRequest("same-token"), new MockHttpServletResponse(),
                blockingOperation("first", concurrent, maxConcurrent, order,
                        firstEntered, firstRelease)));
        assertThat(firstEntered.await(5, TimeUnit.SECONDS)).isTrue();

        Thread second = this.runInThread(() -> this.filter.doFilter(
                refreshRequest("same-token"), new MockHttpServletResponse(),
                blockingOperation("second", concurrent, maxConcurrent, order,
                        secondEntered, secondRelease)));
        // Give the replay generous time to arrive: it must still be waiting
        // OUTSIDE the operation while the first one holds the grant.
        second.join(300);
        assertThat(order).containsExactly("first:enter");
        assertThat(concurrent.get()).isEqualTo(1);

        firstRelease.countDown();
        assertThat(secondEntered.await(5, TimeUnit.SECONDS)).isTrue();
        secondRelease.countDown();
        first.join(5_000);
        second.join(5_000);

        // Deterministic serialization: strictly one operation at a time, in
        // arrival order — a racing replay can never observe the live grant.
        assertThat(maxConcurrent.get()).isEqualTo(1);
        assertThat(order).containsExactly(
                "first:enter", "first:exit", "second:enter", "second:exit");
    }

    @Test
    void nonRefreshRequestsPassThroughUnlocked() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/oauth2/token");
        request.setParameter(OAuth2ParameterNames.GRANT_TYPE, "authorization_code");
        request.setParameter(OAuth2ParameterNames.CODE, "any-code");
        request.setParameter(OAuth2ParameterNames.CLIENT_ID, "yacc-frontend");

        AtomicInteger invoked = new AtomicInteger();
        this.filter.doFilter(request, new MockHttpServletResponse(),
                (req, res) -> invoked.incrementAndGet());

        assertThat(invoked.get()).isEqualTo(1);
    }

    @Test
    void refreshRequestWithoutATokenValuePassesThroughUnlocked() throws Exception {
        MockHttpServletRequest request = refreshRequest(" ");
        AtomicInteger invoked = new AtomicInteger();
        this.filter.doFilter(request, new MockHttpServletResponse(),
                (req, res) -> invoked.incrementAndGet());

        assertThat(invoked.get()).isEqualTo(1);
    }
}
