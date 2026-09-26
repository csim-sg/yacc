package com.yacc.common.controller;

import com.yacc.common.model.ServiceInfoResponse;
import com.yacc.config.YaccProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Service metadata endpoint (MIG-010 scaffold).
 *
 * <p>Codifies the REST route convention (guardrails 004 §5; SPEC-002 TR-04):
 * there is no global route prefix — {@code /api} is declared at the
 * controller {@code @RequestMapping} level, exactly as every later feature
 * controller must do (e.g. {@code @RequestMapping("/api/users")}).</p>
 *
 * <p>Constructor injection only; the bound {@code YaccProperties} record is
 * received as a constructor parameter (SPEC-002 TR-02/TR-03).</p>
 */
@RestController
@RequestMapping("/api")
public class ServiceInfoController {

    private final YaccProperties properties;

    public ServiceInfoController(YaccProperties properties) {
        this.properties = properties;
    }

    @GetMapping
    public ServiceInfoResponse getServiceInfo() {
        return new ServiceInfoResponse(properties.name(), properties.environment());
    }
}
