package com.yacc.auth;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * TEST-ONLY RBAC probe controller — never ships in production sources. It
 * exists so the MIG-030 security tests can prove the four-role matrix gates
 * ({@code @PreAuthorize} + authority mapping) end to end through the real
 * filter chain before the MIG-040 business controllers arrive (tech-lead
 * guardrail: no role inheritance, explicit roles per gate).
 */
@RestController
@RequestMapping("/api/test/rbac")
public class RbacProbeController {

    @GetMapping("/super-admin")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public String superAdminOnly() {
        return "super-admin";
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public String adminOnly() {
        return "admin";
    }

    @GetMapping("/manager")
    @PreAuthorize("hasRole('MANAGER')")
    public String managerOnly() {
        return "manager";
    }

    @GetMapping("/user")
    @PreAuthorize("hasRole('USER')")
    public String userOnly() {
        return "user";
    }
}
