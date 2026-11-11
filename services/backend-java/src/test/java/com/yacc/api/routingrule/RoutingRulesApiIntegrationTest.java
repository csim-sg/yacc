package com.yacc.api.routingrule;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.entity.Tag;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.repository.TagRepository;

/**
 * MIG-040 routing-rule wire tests (ledger rows REST-RULES-001..005; ADR-021
 * leniency): super admin only on all five operations (founder decision B,
 * 2026-11-06, #457 — ADMIN/MANAGER/USER denied at the authorization layer,
 * not by empty results), lenient conditions accepted, referenced tags
 * strictly validated, executions paged.
 */
class RoutingRulesApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUPER_ADMIN = "rules-super-admin@fixture.yacc.local";
    private static final String ADMIN = "rules-admin@fixture.yacc.local";
    private static final String MANAGER = "rules-manager@fixture.yacc.local";
    private static final String USER = "rules-user@fixture.yacc.local";

    @Autowired
    private TagRepository tags;

    @Test
    void superAdminAllowedOnAllFiveOperations() throws Exception {
        seedUser("00000000-0000-0000-0000-00000000d001", SUPER_ADMIN, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        Tag tag = tags.save(new Tag("rules-tag", "#123456",
                "00000000-0000-0000-0000-00000000d001"));
        String superAdminAuth = bearer(SUPER_ADMIN);

        com.fasterxml.jackson.databind.node.ObjectNode createNode = mapper.createObjectNode();
        createNode.put("name", "urgent-telegram");
        createNode.put("priority", 10);
        createNode.put("status", "active");
        var createConditions = mapper.createArrayNode();
        createConditions.addObject().put("field", "keyword").put("operator", "contains")
                .put("value", "urgent");
        createNode.set("conditions", createConditions);
        var createActions = mapper.createArrayNode();
        createActions.addObject().put("type", "tag").put("value", tag.getId());
        createNode.set("actions", createActions);
        String createBody = createNode.toString();

        // POST (create) — 201 + envelope shape.
        String created = mockMvc.perform(post("/api/routing-rules")
                        .header("Authorization", superAdminAuth)
                        .contentType(MediaType.APPLICATION_JSON).content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("urgent-telegram"))
                .andReturn().getResponse().getContentAsString();
        String ruleId = mapper.readTree(created).get("data").get("id").asText();

        // GET (list) — 200 + BaseListResponse envelope.
        mockMvc.perform(get("/api/routing-rules").header("Authorization", superAdminAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        // Lenient future-condition JSON accepted (ADR-021 Strategy B).
        com.fasterxml.jackson.databind.node.ObjectNode lenientNode = mapper.createObjectNode();
        lenientNode.put("name", "future-conditions");
        lenientNode.put("priority", 20);
        var lenientConditions = mapper.createArrayNode();
        lenientConditions.addObject().put("type", "future_condition_type").put("value", "whatever");
        lenientNode.set("conditions", lenientConditions);
        var lenientActions = mapper.createArrayNode();
        lenientActions.addObject().put("type", "assign").put("value",
                "00000000-0000-0000-0000-00000000d001");
        lenientNode.set("actions", lenientActions);
        String lenient = lenientNode.toString();
        mockMvc.perform(post("/api/routing-rules")
                        .header("Authorization", superAdminAuth)
                        .contentType(MediaType.APPLICATION_JSON).content(lenient))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("future-conditions"));

        // Strict referenced-entity check: unknown tag rejected.
        com.fasterxml.jackson.databind.node.ObjectNode unknownNode = mapper.createObjectNode();
        unknownNode.put("name", "broken-tag");
        unknownNode.put("priority", 30);
        var unknownActions = mapper.createArrayNode();
        unknownActions.addObject().put("type", "tag").put("value", 987654);
        unknownNode.set("actions", unknownActions);
        String unknownTag = unknownNode.toString();
        mockMvc.perform(post("/api/routing-rules")
                        .header("Authorization", superAdminAuth)
                        .contentType(MediaType.APPLICATION_JSON).content(unknownTag))
                .andExpect(status().isBadRequest());

        // PATCH (update) — 200 + envelope shape.
        mockMvc.perform(patch("/api/routing-rules/" + ruleId)
                        .header("Authorization", superAdminAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("priority", 50).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.priority").value(50));

        // GET executions — 200 + paged payload.
        mockMvc.perform(get("/api/routing-rules/" + ruleId + "/executions")
                        .header("Authorization", superAdminAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        // DELETE — 200 + envelope shape.
        mockMvc.perform(delete("/api/routing-rules/" + ruleId)
                        .header("Authorization", superAdminAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(ruleId));

        mockMvc.perform(patch("/api/routing-rules/" + ruleId)
                        .header("Authorization", superAdminAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("priority", 60).toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminDeniedOnAllFiveOperations() throws Exception {
        String adminAuth = seedDeniedRoleProbe(ADMIN, UserRole.ADMIN);
        String ruleId = seedExistingRule();
        denyAllFiveOperations(adminAuth, ruleId);
    }

    @Test
    void managerDeniedOnAllFiveOperations() throws Exception {
        String managerAuth = seedDeniedRoleProbe(MANAGER, UserRole.MANAGER);
        String ruleId = seedExistingRule();
        denyAllFiveOperations(managerAuth, ruleId);
    }

    @Test
    void userDeniedOnAllFiveOperations() throws Exception {
        String userAuth = seedDeniedRoleProbe(USER, UserRole.USER);
        String ruleId = seedExistingRule();
        denyAllFiveOperations(userAuth, ruleId);
    }

    /**
     * Authorization-layer denial on every operation: each request carries a
     * valid payload against an existing rule, so the 403 can only come from
     * {@code @PreAuthorize} — never from validation (400) or a missing
     * resource (404). The rule still exists afterwards because the denied
     * requests never reach the handlers.
     */
    private void denyAllFiveOperations(String deniedAuth, String ruleId) throws Exception {
        mockMvc.perform(post("/api/routing-rules")
                        .header("Authorization", deniedAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validAssignRuleBody("denied-create")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/routing-rules").header("Authorization", deniedAuth))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/routing-rules/" + ruleId)
                        .header("Authorization", deniedAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("priority", 50).toString()))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/routing-rules/" + ruleId + "/executions")
                        .header("Authorization", deniedAuth))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/routing-rules/" + ruleId)
                        .header("Authorization", deniedAuth))
                .andExpect(status().isForbidden());
    }

    /** Seeds all four roles and returns the bearer auth for the denied role. */
    private String seedDeniedRoleProbe(String deniedEmail, UserRole deniedRole) throws Exception {
        seedUser("00000000-0000-0000-0000-00000000d001", SUPER_ADMIN, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000d002", ADMIN, UserRole.ADMIN,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000d003", MANAGER, UserRole.MANAGER,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000d004", USER, UserRole.USER,
                UserStatus.ACTIVE);
        bearer(SUPER_ADMIN); // proves the success path is not locked out
        return bearer(deniedEmail);
    }

    /** Creates a real rule as SUPER_ADMIN so denials hit an existing resource. */
    private String seedExistingRule() throws Exception {
        String created = mockMvc.perform(post("/api/routing-rules")
                        .header("Authorization", bearer(SUPER_ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validAssignRuleBody("seeded-rule")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(created).get("data").get("id").asText();
    }

    /** Valid create payload (assign action referencing the seeded super admin). */
    private String validAssignRuleBody(String name) {
        var node = mapper.createObjectNode();
        node.put("name", name);
        node.put("priority", 10);
        node.put("status", "active");
        var conditions = mapper.createArrayNode();
        conditions.addObject().put("field", "keyword").put("operator", "contains")
                .put("value", "urgent");
        node.set("conditions", conditions);
        var actions = mapper.createArrayNode();
        actions.addObject().put("type", "assign").put("value",
                "00000000-0000-0000-0000-00000000d001");
        node.set("actions", actions);
        return node.toString();
    }
}
