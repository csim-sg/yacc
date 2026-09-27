package com.yacc.audit;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.yacc.audit.model.AuditLog;
import com.yacc.audit.repository.AuditLogRepository;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;

/**
 * MIG-040 audit wire tests (ledger rows REST-AUDIT-001,
 * REST-AUDITLOG-001..003): conversation-scoped page shape, filtered queries
 * with date validation, and the CSV/JSON export download contract.
 */
class AuditLogsApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String MANAGER = "audit-manager@fixture.yacc.local";
    private static final String ADMIN = "audit-admin@fixture.yacc.local";
    private static final String USER = "audit-user@fixture.yacc.local";
    /** Same id as the seeded manager: audit rows FK-reference the actor. */
    private static final String MANAGER_ID = "00000000-0000-0000-0000-00000000aa01";
    private static final String ADMIN_ID = "00000000-0000-0000-0000-00000000aa04";

    @Autowired
    private AuditLogRepository logs;

    private AuditLog seedLog(UUID conversationId, String action) {
        return logs.save(new AuditLog(UUID.randomUUID(), MANAGER_ID, action, "conversation",
                conversationId, null));
    }

    @Test
    void managerReadsConversationAuditPage() throws Exception {
        seedUser("00000000-0000-0000-0000-00000000aa01", MANAGER, UserRole.MANAGER,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000aa03", USER, UserRole.USER,
                UserStatus.ACTIVE);
        UUID conversationId = UUID.randomUUID();
        seedLog(conversationId, "conversation_status_change");
        seedLog(conversationId, "conversation_assigned");
        String managerAuth = bearer(MANAGER);

        mockMvc.perform(get("/api/conversations/" + conversationId + "/audit-logs")
                        .header("Authorization", managerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.pages").value(1));

        mockMvc.perform(get("/api/conversations/" + conversationId + "/audit-logs")
                        .header("Authorization", bearer(USER)))
                .andExpect(status().isForbidden());
    }

    @Test
    void queryFiltersAndExportDownload() throws Exception {
        seedUser("00000000-0000-0000-0000-00000000aa01", MANAGER, UserRole.MANAGER,
                UserStatus.ACTIVE);
        seedUser(ADMIN_ID, ADMIN, UserRole.ADMIN, UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000aa03", USER, UserRole.USER,
                UserStatus.ACTIVE);
        UUID conversationId = UUID.randomUUID();
        seedLog(conversationId, "bulk_action_applied");
        String auth = bearer(MANAGER);
        String adminAuth = bearer(ADMIN);

        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", auth).param("action", "bulk_action_applied"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1));

        mockMvc.perform(get("/api/audit-logs")
                        .header("Authorization", auth).param("dateFrom", "not-a-date"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/audit-logs/conversations/" + conversationId)
                        .header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1));

        // Manager denied (admin+ only), admin export succeeds.
        mockMvc.perform(post("/api/audit-logs/export")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("format", "csv").toString()))
                .andExpect(status().isForbidden());

        String csv = mockMvc.perform(post("/api/audit-logs/export")
                        .header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("format", "csv").toString()))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "text/csv"))
                .andExpect(header().string("Content-Disposition",
                        org.hamcrest.Matchers.containsString("attachment; filename=\"audit-logs-")))
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(csv).startsWith("ID,Actor ID,Action");

        mockMvc.perform(post("/api/audit-logs/export")
                        .header("Authorization", bearer(USER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("format", "csv").toString()))
                .andExpect(status().isForbidden());
    }
}
