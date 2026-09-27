package com.yacc.config;

import java.util.EnumSet;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

import jakarta.servlet.DispatcherType;

/**
 * Correlation-id filter + its registration, both in {@code config} per the
 * tech-lead placement ruling on this issue (guardrails 004 §4/§5:
 * middleware-equivalents are servlet filters registered via configuration —
 * never scattered registration inside controllers).
 *
 * <p>Runs first on every request (including actuator endpoints, matching the
 * POC middleware order) and on async/error dispatches so error-path logs keep
 * their correlation id.</p>
 */
@Configuration
public class CorrelationIdFilterConfig {

    @Bean
    public FilterRegistrationBean<CorrelationIdFilter> correlationIdFilter() {
        FilterRegistrationBean<CorrelationIdFilter> registration =
                new FilterRegistrationBean<>(new CorrelationIdFilter());
        registration.addUrlPatterns("/*");
        registration.setDispatcherTypes(EnumSet.of(DispatcherType.REQUEST, DispatcherType.ASYNC, DispatcherType.ERROR));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }
}
