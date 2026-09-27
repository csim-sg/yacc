package com.yacc.dlq;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.dlq.model.DeadLetterQueueEntry;
import com.yacc.dlq.repository.DeadLetterQueueEntryRepository;
import com.yacc.message.model.Message;
import com.yacc.message.model.MessageDirection;
import com.yacc.message.repository.MessageRepository;

/**
 * MIG-040 DLQ + queue wire tests (ledger rows REST-DLQ-001..004,
 * REST-QUEUE-001..008): manager+ read surface, admin+ re-queue,
 * super_admin-only removal/clear, once-only retry markers, and the
 * by-reason filter.
 */
class DlqQueueApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUPER = "queue-super@fixture.yacc.local";
    private static final String MANAGER = "queue-manager@fixture.yacc.local";
    private static final String MANAGER_ID = "00000000-0000-0000-0000-00000000cc02";

    @Autowired
    private DeadLetterQueueEntryRepository dlq;
    @Autowired
    private MessageRepository messages;
    @Autowired
    private com.yacc.conversation.repository.ConversationRepository conversations;

    private DeadLetterQueueEntry seedEntry(String reason) {
        var conversation = conversations.save(new com.yacc.conversation.model.Conversation(
                UUID.randomUUID(), com.yacc.conversation.model.ChannelType.IRC, "#dlq"));
        Message message = messages.save(new Message(UUID.randomUUID(), conversation.getId(),
                null, "external-sender", "body", MessageDirection.INBOUND));
        message.setStatus(com.yacc.message.model.MessageStatus.FAILED);
        messages.save(message);
        return dlq.save(new DeadLetterQueueEntry(UUID.randomUUID(), message.getId(),
                conversation.getId(), "{}", reason, 3, "boom",
                LocalDateTime.now().plusDays(7)));
    }

    private void seedActors() {
        seedUser("00000000-0000-0000-0000-00000000cc01", SUPER, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        seedUser(MANAGER_ID, MANAGER, UserRole.MANAGER, UserStatus.ACTIVE);
    }

    @Test
    void listStatsReQueueAndRemoveFollowRoleMatrix() throws Exception {
        seedActors();
        DeadLetterQueueEntry entry = seedEntry("delivery_timeout");
        String managerAuth = bearer(MANAGER);
        String superAuth = bearer(SUPER);

        mockMvc.perform(get("/api/dlq").header("Authorization", managerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries").isArray())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.limit").value(25));

        mockMvc.perform(get("/api/dlq").header("Authorization", managerAuth)
                        .param("limit", "200"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/dlq/stats").header("Authorization", managerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").isNumber())
                .andExpect(jsonPath("$.byFailureReason").exists());

        // Manager may NOT re-queue (admin+).
        mockMvc.perform(post("/api/dlq/" + entry.getId() + "/re-queue")
                        .header("Authorization", managerAuth))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/dlq/" + entry.getId() + "/re-queue")
                        .header("Authorization", superAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entry.retryAttempt").value(true));

        // Manager may NOT delete.
        mockMvc.perform(delete("/api/dlq/" + entry.getId()).header("Authorization", managerAuth))
                .andExpect(status().isForbidden());

        mockMvc.perform(delete("/api/dlq/" + entry.getId()).header("Authorization", superAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deletedEntry.id").value(entry.getId().toString()));

        assertThat(dlq.findById(entry.getId())).isEmpty();
    }

    @Test
    void queueSurfaceStatsRetryBulkAndByReason() throws Exception {
        seedActors();
        DeadLetterQueueEntry entry = seedEntry("irc_send_failed");
        String managerAuth = bearer(MANAGER);

        mockMvc.perform(get("/api/queue/stats").header("Authorization", managerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dlq").value(1))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());

        mockMvc.perform(get("/api/queue/dlq").header("Authorization", managerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].messageId").value(entry.getMessageId().toString()));

        mockMvc.perform(post("/api/queue/retry/" + entry.getMessageId())
                        .header("Authorization", managerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Bulk retry with an unknown id reports a per-id error.
        mockMvc.perform(post("/api/queue/dlq/retry")
                        .header("Authorization", managerAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .set("messageIds", mapper.createArrayNode()
                                        .add(UUID.randomUUID().toString()))
                                .toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.successful").value(0))
                .andExpect(jsonPath("$.failed").value(1));

        mockMvc.perform(get("/api/queue/dlq/stats").header("Authorization", managerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats.totalEntries").value(1))
                .andExpect(jsonPath("$.timestamp").isNotEmpty());

        mockMvc.perform(get("/api/queue/job/" + entry.getMessageId())
                        .header("Authorization", managerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.job.state").value("failed"));

        mockMvc.perform(get("/api/queue/job/" + UUID.randomUUID())
                        .header("Authorization", managerAuth))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/queue/dlq/by-reason/irc_send_failed")
                        .header("Authorization", managerAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1));

        // Clear requires super_admin.
        mockMvc.perform(post("/api/queue/dlq/clear/" + entry.getMessageId())
                        .header("Authorization", managerAuth))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/queue/dlq/clear/" + entry.getMessageId())
                        .header("Authorization", bearer(SUPER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
