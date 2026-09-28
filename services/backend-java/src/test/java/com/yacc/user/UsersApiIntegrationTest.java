package com.yacc.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Locale;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;

/**
 * MIG-040 users wire tests (ledger rows REST-USER-001..005): super_admin
 * CRUD with self-guards and RBAC denials, the static role matrix, and the
 * frozen envelope/error shapes.
 */
class UsersApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUPER = "super-admin-users@fixture.yacc.local";
    private static final String PLAIN = "plain-users@fixture.yacc.local";

    private void seedActors() {
        seedUser("00000000-0000-0000-0000-00000000e001", SUPER, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000e002", PLAIN, UserRole.USER,
                UserStatus.ACTIVE);
    }

    @Test
    void superAdminListsUsersWithFrozenEnvelope() throws Exception {
        seedActors();
        mockMvc.perform(get("/api/users").header("Authorization", bearer(SUPER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.limit").value(20))
                .andExpect(jsonPath("$.total").isNumber());
    }

    @Test
    void createUserThenUpdateThenSoftDelete() throws Exception {
        seedActors();
        String auth = bearer(SUPER);
        String body = mapper.createObjectNode()
                .put("email", "created@fixture.yacc.local")
                .put("password", "created-password-1")
                .put("name", "Created User")
                .put("role", "manager")
                .toString();
        String createdId = mapper.readTree(mockMvc.perform(post("/api/users")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("manager"))
                .andExpect(jsonPath("$.status").value("active"))
                .andReturn().getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(put("/api/users/" + createdId).header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("name", "Renamed").toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"));

        mockMvc.perform(put("/api/users/" + createdId).header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("role", "admin").toString()))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/users/" + createdId).header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(createdId))
                .andExpect(jsonPath("$.deletedAt").isNotEmpty());
    }

    @Test
    void duplicateEmailConflictsAndSelfModificationForbidden() throws Exception {
        seedActors();
        String auth = bearer(SUPER);
        mockMvc.perform(post("/api/users").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("email", SUPER.toUpperCase(Locale.ROOT))
                                .put("password", "whatever-password")
                                .put("name", "Dup")
                                .put("role", "user").toString()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("Email already registered"));

        String superId = "00000000-0000-0000-0000-00000000e001";
        mockMvc.perform(put("/api/users/" + superId).header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("role", "user").toString()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("Cannot modify your own role or status"));

        mockMvc.perform(delete("/api/users/" + superId).header("Authorization", auth))
                .andExpect(status().isForbidden());
    }

    @Test
    void nonSuperAdminDeniedAndRolesReadable() throws Exception {
        seedActors();
        mockMvc.perform(get("/api/users").header("Authorization", bearer(PLAIN)))
                .andExpect(status().isForbidden());

        String roles = mockMvc.perform(get("/api/users/roles").header("Authorization", bearer(PLAIN)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(mapper.readTree(roles).get("roles")).hasSize(4);
    }

    @Test
    void invalidLimitRejected() throws Exception {
        seedActors();
        mockMvc.perform(get("/api/users").header("Authorization", bearer(SUPER))
                        .param("limit", "33"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Limit must be 20, 50, or 100"));
    }
}
