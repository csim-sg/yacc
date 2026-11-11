package com.yacc.api.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;

/**
 * AC-11 status-denial proof on the protected <em>business</em> surfaces
 * (.docs/qa/rbac-coverage-matrix.md §2.2/§6; issue #457). The auth-surface
 * denial is pinned by {@code AuthFlowIntegrationTest#suspendedIdentityIsDeniedOnProtectedRest}
 * / {@code #inactiveIdentityIsDeniedOnProtectedRest}; this class proves the
 * same shared seam ({@code BearerTokenAuthenticationConverter} →
 * {@code TokenAuthenticationService#requireActive}) denies inactive and
 * suspended identities on a representative REST read
 * ({@code GET /api/conversations}) and write ({@code POST /api/tags}) —
 * 401 <em>before any role gate</em> (a role denial would answer 403) — and,
 * on the same rows, that the active identity of the same role is allowed
 * (the 2026-10-18 shared-inbox viewing allow and the GOV-021 tag-create
 * allow).
 */
class RbacStatusDenialIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUSPENDED_EMAIL = "matrix-suspended@fixture.yacc.local";
    private static final String SUSPENDED_ID = "00000000-0000-0000-0000-00000000e201";
    private static final String INACTIVE_EMAIL = "matrix-inactive@fixture.yacc.local";
    private static final String INACTIVE_ID = "00000000-0000-0000-0000-00000000e202";

    @Test
    void suspendedIdentityIsDeniedOnBusinessRestReadAndWrite() throws Exception {
        seedUser(SUSPENDED_ID, SUSPENDED_EMAIL, UserRole.USER, UserStatus.ACTIVE);
        String token = token(SUSPENDED_EMAIL);

        // Active identity: the viewing read and the tag write are allowed
        // (USER role on the business surface).
        mockMvc.perform(get("/api/conversations")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/tags")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("name", "status-denial-tag")
                                .put("color", "#AA12BC").toString()))
                .andExpect(status().isCreated());

        // Suspension takes effect on the very next request — 401 (identity
        // seam) before any role gate (which would answer 403).
        var user = users.findById(SUSPENDED_ID).orElseThrow();
        user.setStatus(UserStatus.SUSPENDED);
        users.save(user);

        mockMvc.perform(get("/api/conversations")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/tags")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("name", "status-denial-tag-2").toString()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void inactiveIdentityIsDeniedOnBusinessRestReadAndWrite() throws Exception {
        seedUser(INACTIVE_ID, INACTIVE_EMAIL, UserRole.USER, UserStatus.ACTIVE);
        String token = token(INACTIVE_EMAIL);

        var user = users.findById(INACTIVE_ID).orElseThrow();
        user.setStatus(UserStatus.INACTIVE);
        users.save(user);

        mockMvc.perform(get("/api/conversations")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/tags")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("name", "status-denial-tag-3").toString()))
                .andExpect(status().isUnauthorized());
    }
}
