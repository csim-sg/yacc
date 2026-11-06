package com.yacc.api.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.entity.User;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;

/**
 * MIG-091d-fix wire pin (frozen contract {@code listUsers}; ADR-023,
 * canonicalization §1.5 "lowercase on the wire"): the {@code role} and
 * {@code status} query filters bind the exact lowercase PostgreSQL labels
 * through the enums' {@code fromLabel} creator — every frozen label is
 * accepted (200 + correct filtering) while the Java constant names and any
 * other casing stay 400 (parity, no case superset). Caller is super_admin,
 * matching the {@code listUsers} RBAC.
 */
class UsersListEnumQueryLabelIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUPER = "super-admin-userlabels@fixture.yacc.local";
    private static final String PLAIN = "plain-userlabels@fixture.yacc.local";
    private static final String MANAGER = "manager-userlabels@fixture.yacc.local";
    private static final String ADMIN = "admin-userlabels@fixture.yacc.local";

    /**
     * Orthogonal role × status fixtures: each frozen role and each frozen
     * status label matches a distinct, assertable identity subset.
     */
    private List<User> seedRoleAndStatusFixtures() {
        return List.of(
                seedUser("00000000-0000-0000-0000-00000000b001", SUPER,
                        UserRole.SUPER_ADMIN, UserStatus.ACTIVE),
                seedUser("00000000-0000-0000-0000-00000000b002", PLAIN,
                        UserRole.USER, UserStatus.ACTIVE),
                seedUser("00000000-0000-0000-0000-00000000b003", MANAGER,
                        UserRole.MANAGER, UserStatus.INACTIVE),
                seedUser("00000000-0000-0000-0000-00000000b004", ADMIN,
                        UserRole.ADMIN, UserStatus.SUSPENDED));
    }

    /** Lists with the given query string and returns the emails on the wire. */
    private Set<String> listedEmails(String queryString, String auth) throws Exception {
        JsonNode body = mapper.readTree(mockMvc.perform(get("/api/users" + queryString)
                        .header("Authorization", auth))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        Set<String> emails = new HashSet<>();
        body.get("data").forEach(item -> emails.add(item.get("email").asText()));
        assertThat(emails.size()).isEqualTo(body.get("total").asInt());
        return emails;
    }

    @Test
    void everyFrozenRoleLabelBindsAndFilters() throws Exception {
        List<User> fixtures = seedRoleAndStatusFixtures();
        String auth = bearer(SUPER);

        for (UserRole role : UserRole.values()) {
            Set<String> expected = fixtures.stream()
                    .filter(user -> user.getRole() == role)
                    .map(User::getEmail)
                    .collect(Collectors.toSet());
            if (role == UserRole.SUPER_ADMIN) {
                // The startup SuperAdminBootstrap identity is committed outside
                // the per-test rollback and is a live super_admin in every
                // test of this cached context.
                expected.add(BOOTSTRAP_EMAIL);
            }
            assertThat(listedEmails("?role=" + role.getLabel(), auth))
                    .as("filter ?role=%s", role.getLabel())
                    .containsExactlyInAnyOrderElementsOf(expected);
        }
    }

    @Test
    void everyFrozenStatusLabelBindsAndFilters() throws Exception {
        List<User> fixtures = seedRoleAndStatusFixtures();
        String auth = bearer(SUPER);

        for (UserStatus status : UserStatus.values()) {
            Set<String> expected = fixtures.stream()
                    .filter(user -> user.getStatus() == status)
                    .map(User::getEmail)
                    .collect(Collectors.toSet());
            if (status == UserStatus.ACTIVE) {
                // See the role note: the bootstrap super admin is active and
                // outside the per-test rollback.
                expected.add(BOOTSTRAP_EMAIL);
            }
            assertThat(listedEmails("?status=" + status.getLabel(), auth))
                    .as("filter ?status=%s", status.getLabel())
                    .containsExactlyInAnyOrderElementsOf(expected);
        }
    }

    /** Contract parity direction: enum names and unknown values stay 400. */
    @Test
    void nonLabelRoleAndStatusFormsStay400() throws Exception {
        seedRoleAndStatusFixtures();
        String auth = bearer(SUPER);

        mockMvc.perform(get("/api/users").param("role", "USER")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation error"));
        mockMvc.perform(get("/api/users").param("role", "User")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/users").param("status", "ACTIVE")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/users").param("status", "nope")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest());
    }
}
