package com.yacc.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/**
 * Tests for {@link CorrelationIdFilter} (POC {@code correlationId.middleware.ts}
 * parity: inherit {@code X-Correlation-Id}, fall back to {@code X-Request-Id},
 * generate otherwise; echo header; bind and clear MDC).
 */
class CorrelationIdFilterTest {

    private final CorrelationIdFilter filter = new CorrelationIdFilter();

    @Test
    void usesIncomingCorrelationIdHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api");
        request.addHeader("X-Correlation-Id", "corr-123");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> inRequest = new AtomicReference<>();

        filter.doFilter(request, response, (req, res) -> inRequest.set(MDC.get(CorrelationIdFilter.CORRELATION_ID_MDC_KEY)));

        assertThat(inRequest.get()).isEqualTo("corr-123");
        assertThat(response.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER)).isEqualTo("corr-123");
    }

    @Test
    void fallsBackToRequestIdHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api");
        request.addHeader("X-Request-Id", "req-456");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> { });

        assertThat(response.getHeader(CorrelationIdFilter.CORRELATION_ID_HEADER)).isEqualTo("req-456");
    }

    @Test
    void generatesUuidAndClearsMdcAfterwards() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> inRequest = new AtomicReference<>();

        filter.doFilter(request, response, (req, res) -> inRequest.set(MDC.get(CorrelationIdFilter.CORRELATION_ID_MDC_KEY)));

        assertThat(inRequest.get()).isNotBlank().isNotEqualTo("corr-123");
        assertThat(MDC.get(CorrelationIdFilter.CORRELATION_ID_MDC_KEY)).isNull();
    }
}
