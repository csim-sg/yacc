package com.yacc.common.contract;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;

/**
 * MIG-040 route-coverage conformance check (AC-MIG-040-1; ADR-023
 * contract-first): every REST path+method in the frozen
 * {@code openapi.yaml} (v1.0.0-mig-003-canonical) must be served by a
 * registered Spring MVC handler — no ledger-recorded route may be missing.
 * Exclusions are contract-documented, not judgment calls:
 *
 * <ul>
 *   <li>{@code /health**} — Actuator health groups (ADR-029 remap; wired and
 *       evidenced by MIG-010/MIG-012, served outside
 *       {@link RequestMappingHandlerMapping});</li>
 *   <li>{@code /api/auth/oidc/**} — config-gated RP surface, present only
 *       with {@code yacc.auth.oauth2.enabled=true} (contract path note);
 *       exercised by the MIG-032 config-gated tests.</li>
 * </ul>
 *
 * <p>Payload-level contract tests land with MIG-041 (its scope).</p>
 */
@AutoConfigureMockMvc
class RestRouteCoverageConformanceTest extends AbstractApiIntegrationTest {

    @org.springframework.beans.factory.annotation.Qualifier("requestMappingHandlerMapping")
    @Autowired
    private RequestMappingHandlerMapping handlerMapping;

    @Test
    void everyFrozenOpenApiRouteIsImplemented() throws IOException {
        Set<String> implemented = implementedOperations();
        Set<String> frozen = frozenOperations();

        Set<String> missing = frozen.stream()
                .filter(route -> !implemented.contains(route))
                .collect(Collectors.toSet());

        assertThat(missing)
                .as("frozen OpenAPI routes without a Spring handler")
                .isEmpty();
    }

    private Set<String> implementedOperations() {
        Set<String> operations = new HashSet<>();
        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : handlerMapping
                .getHandlerMethods().entrySet()) {
            RequestMappingInfo info = entry.getKey();
            info.getPathPatternsCondition().getPatterns().forEach(pattern -> {
                String path = pattern.getPatternString();
                Set<org.springframework.web.bind.annotation.RequestMethod> methods = info
                        .getMethodsCondition().getMethods();
                if (methods.isEmpty()) {
                    operations.add("ANY " + path);
                } else {
                    methods.forEach(method -> operations.add(method.name() + " " + path));
                }
            });
        }
        return operations;
    }

    private Set<String> frozenOperations() throws IOException {
        try (InputStream contract = getClass().getResourceAsStream("/contract/openapi.yaml")) {
            assertThat(contract).as("frozen openapi.yaml on the test classpath").isNotNull();
            JsonNode root = new ObjectMapper(new YAMLFactory()).readTree(contract);
            Set<String> operations = new HashSet<>();
            root.get("paths").properties().forEach(pathEntry -> {
                String path = pathEntry.getKey();
                if (path.equals("/health") || path.startsWith("/health/")
                        || path.startsWith("/api/auth/oidc/")) {
                    return;
                }
                pathEntry.getValue().properties().forEach(methodEntry -> {
                    String method = methodEntry.getKey().toLowerCase(Locale.ROOT);
                    if (List.of("get", "post", "put", "patch", "delete").contains(method)) {
                        operations.add(method.toUpperCase(Locale.ROOT) + " " + path);
                    }
                });
            });
            return operations;
        }
    }
}
