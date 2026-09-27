package com.yacc.routingrule;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.tag.model.Tag;
import com.yacc.tag.repository.TagRepository;

/**
 * MIG-040 routing-rule wire tests (ledger rows REST-RULES-001..005; ADR-021
 * leniency): manager+ reads, admin+ writes, lenient conditions accepted,
 * referenced tags strictly validated, executions paged.
 */
class RoutingRulesApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String ADMIN = "rules-admin@fixture.yacc.local";
    private static final String MANAGER = "rules-manager@fixture.yacc.local";

    @Autowired
    private TagRepository tags;

    @Test
    void crudLifecycleWithRbacAndLenientJson() throws Exception {
        seedUser("00000000-0000-0000-0000-00000000d001", ADMIN, UserRole.ADMIN,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000d002", MANAGER, UserRole.MANAGER,
                UserStatus.ACTIVE);
        Tag tag = tags.save(new Tag("rules-tag", "#123456",
                "00000000-0000-0000-0000-00000000d001"));
        String adminAuth = bearer(ADMIN);
        String managerAuth = bearer(MANAGER);

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

        String created = mockMvc.perform(post("/api/routing-rules")
                        .header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON).content(createBody))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.name").value("urgent-telegram"))
                .andReturn().getResponse().getContentAsString();
        String ruleId = mapper.readTree(created).get("data").get("id").asText();

        // Manager cannot create (admin+ only).
        mockMvc.perform(post("/api/routing-rules")
                        .header("Authorization", managerAuth)
                        .contentType(MediaType.APPLICATION_JSON).content(createBody))
                .andExpect(status().isForbidden());

        // Manager CAN read.
        mockMvc.perform(get("/api/routing-rules").header("Authorization", managerAuth))
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
                        .header("Authorization", adminAuth)
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
                        .header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON).content(unknownTag))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/routing-rules/" + ruleId)
                        .header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("priority", 50).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.priority").value(50));

        mockMvc.perform(get("/api/routing-rules/" + ruleId + "/executions")
                        .header("Authorization", managerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        mockMvc.perform(delete("/api/routing-rules/" + ruleId)
                        .header("Authorization", adminAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(ruleId));

        mockMvc.perform(patch("/api/routing-rules/" + ruleId)
                        .header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("priority", 60).toString()))
                .andExpect(status().isNotFound());
    }
}
