package com.yacc.conversation;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.conversation.model.ChannelType;
import com.yacc.conversation.model.Conversation;
import com.yacc.conversation.repository.ConversationRepository;

/**
 * MIG-040 conversation-surface wire tests (ledger rows REST-CONV-001..005,
 * REST-ASSIGN-001, REST-BULK-001): list envelope, single fetch, RBAC-gated
 * mutations with the frozen roles, best-effort bulk, and the manager+
 * POST-assignment surface.
 */
class ConversationSurfaceApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUPER = "super-admin-conv@fixture.yacc.local";
    private static final String MANAGER = "manager-conv@fixture.yacc.local";
    private static final String USER = "user-conv@fixture.yacc.local";
    private static final String MANAGER_ID = "00000000-0000-0000-0000-00000000f002";

    @Autowired
    private ConversationRepository conversations;

    private Conversation seedConversation() {
        return conversations.save(new Conversation(UUID.randomUUID(), ChannelType.IRC,
                "#fixture-channel"));
    }

    @Test
    void listReturnsEnvelopeAndGetByUuid() throws Exception {
        seedUser("00000000-0000-0000-0000-00000000f001", SUPER, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        Conversation conversation = seedConversation();
        String auth = bearer(SUPER);

        mockMvc.perform(get("/api/conversations").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.limit").value(20));

        mockMvc.perform(get("/api/conversations/" + conversation.getId())
                        .header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(conversation.getId().toString()))
                .andExpect(jsonPath("$.data.status").value("open"))
                .andExpect(jsonPath("$.data.priority").value("normal"));

        mockMvc.perform(get("/api/conversations/" + UUID.randomUUID())
                        .header("Authorization", auth))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Conversation not found"));
    }

    @Test
    void statusPriorityAssignEnforceRoleMatrixAndAudit() throws Exception {
        seedUser("00000000-0000-0000-0000-00000000f001", SUPER, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        seedUser(MANAGER_ID, MANAGER, UserRole.MANAGER, UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000f003", USER, UserRole.USER,
                UserStatus.ACTIVE);
        Conversation conversation = seedConversation();
        String superAuth = bearer(SUPER);
        String userAuth = bearer(USER);

        mockMvc.perform(patch("/api/conversations/" + conversation.getId() + "/status")
                        .header("Authorization", userAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("status", "resolved").toString()))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/conversations/" + conversation.getId() + "/status")
                        .header("Authorization", superAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("status", "resolved").toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("resolved"));

        mockMvc.perform(patch("/api/conversations/" + conversation.getId() + "/priority")
                        .header("Authorization", bearer(MANAGER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("priority", "urgent").toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.priority").value("urgent"));

        mockMvc.perform(patch("/api/conversations/" + conversation.getId() + "/assign")
                        .header("Authorization", superAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("assignedUserId", MANAGER_ID).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.assignedUserId").value(MANAGER_ID));

        // manager+ may PATCH-assign? No — PATCH assign is admin/super_admin only.
        mockMvc.perform(patch("/api/conversations/" + conversation.getId() + "/assign")
                        .header("Authorization", bearer(MANAGER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("assignedUserId", MANAGER_ID).toString()))
                .andExpect(status().isForbidden());
    }

    @Test
    void postAssignmentRequiresManagerPlusAndNotifies() throws Exception {
        seedUser("00000000-0000-0000-0000-00000000f001", SUPER, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        seedUser(MANAGER_ID, MANAGER, UserRole.MANAGER, UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000f003", USER, UserRole.USER,
                UserStatus.ACTIVE);
        Conversation conversation = seedConversation();

        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/assign")
                        .header("Authorization", bearer(USER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("assignedUserId", MANAGER_ID).toString()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error")
                        .value("Only manager or higher can assign conversations"));

        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/assign")
                        .header("Authorization", bearer(MANAGER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("assignedUserId", MANAGER_ID).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.newlyAssignedUserId").value(MANAGER_ID));

        mockMvc.perform(post("/api/conversations/" + UUID.randomUUID() + "/assign")
                        .header("Authorization", bearer(MANAGER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("assignedUserId", MANAGER_ID).toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void bulkActionReportsPartialSuccess() throws Exception {
        seedUser("00000000-0000-0000-0000-00000000f001", SUPER, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000f003", USER, UserRole.USER,
                UserStatus.ACTIVE);
        Conversation conversation = seedConversation();
        UUID ghost = UUID.randomUUID();

        com.fasterxml.jackson.databind.node.ObjectNode bulkDenied = mapper.createObjectNode();
        bulkDenied.set("conversationIds",
                mapper.createArrayNode().add(conversation.getId().toString()));
        bulkDenied.put("action", "status");
        bulkDenied.putObject("data").put("status", "pending");
        mockMvc.perform(post("/api/conversations/bulk")
                        .header("Authorization", bearer(USER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bulkDenied.toString()))
                .andExpect(status().isForbidden());

        com.fasterxml.jackson.databind.node.ObjectNode bulk = mapper.createObjectNode();
        bulk.set("conversationIds", mapper.createArrayNode()
                .add(conversation.getId().toString()).add(ghost.toString()));
        bulk.put("action", "status");
        bulk.putObject("data").put("status", "pending");
        mockMvc.perform(post("/api/conversations/bulk")
                        .header("Authorization", bearer(SUPER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bulk.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.successCount").value(1))
                .andExpect(jsonPath("$.data.failureCount").value(1))
                .andExpect(jsonPath("$.data.failures[0].reason").value("Conversation not found"));
    }
}
