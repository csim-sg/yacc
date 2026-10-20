package com.yacc.api.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.entity.ChannelType;
import com.yacc.entity.Conversation;
import com.yacc.repository.ConversationRepository;
import com.yacc.entity.DeadLetterQueueEntry;
import com.yacc.repository.DeadLetterQueueEntryRepository;
import com.yacc.entity.Message;
import com.yacc.entity.MessageDirection;
import com.yacc.entity.MessageStatus;
import com.yacc.repository.MessageRepository;

/**
 * MIG-040 message wire tests (ledger rows REST-MSG-001..004): the frozen
 * custom list shape, the {data} send envelope with pending status,
 * assignment-based retry RBAC, and the once-only manual retry over the DB
 * DLQ.
 */
class MessageApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUPER = "super-admin-msg@fixture.yacc.local";
    private static final String ADMIN = "admin-msg@fixture.yacc.local";
    private static final String MANAGER = "manager-msg@fixture.yacc.local";
    private static final String ASSIGNED_USER = "assigned-user@fixture.yacc.local";
    private static final String ASSIGNED_USER_ID = "00000000-0000-0000-0000-00000000a201";
    private static final String OTHER_USER = "other-user@fixture.yacc.local";
    private static final String OTHER_USER_ID = "00000000-0000-0000-0000-00000000a202";

    @Autowired
    private ConversationRepository conversations;
    @Autowired
    private MessageRepository messages;
    @Autowired
    private DeadLetterQueueEntryRepository dlq;

    private void seedActors() {
        seedUser("00000000-0000-0000-0000-00000000a200", SUPER, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        seedUser(ASSIGNED_USER_ID, ASSIGNED_USER, UserRole.USER, UserStatus.ACTIVE);
        seedUser(OTHER_USER_ID, OTHER_USER, UserRole.USER, UserStatus.ACTIVE);
    }

    private Message seedMessage(UUID conversationId, MessageStatus status) {
        Message message = new Message(UUID.randomUUID(), conversationId, ASSIGNED_USER_ID,
                "Assigned", "failed body", MessageDirection.OUTBOUND);
        message.setStatus(status);
        return messages.save(message);
    }

    @Test
    void listUsesFrozenCustomShapeAndSendReturnsDataEnvelope() throws Exception {
        seedActors();
        Conversation conversation = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, "chat-1"));
        seedMessage(conversation.getId(), MessageStatus.SENT);
        String auth = bearer(SUPER);

        mockMvc.perform(get("/api/conversations/" + conversation.getId() + "/messages")
                        .header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages").isArray())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.limit").value(50));

        String response = mockMvc.perform(
                        post("/api/conversations/" + conversation.getId() + "/messages")
                                .header("Authorization", auth)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(mapper.createObjectNode()
                                        .put("body", "hello from the wire test").toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("pending"))
                .andExpect(jsonPath("$.data.direction").value("outbound"))
                .andReturn().getResponse().getContentAsString();
        assertThat(mapper.readTree(response).get("data").get("id")).isNotNull();

        // Oversized body → 400
        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/messages")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("body", "x".repeat(10001)).toString()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void retryIsOnceOnlyAndRequiresAssignmentForUserRole() throws Exception {
        seedActors();
        Conversation conversation = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.IRC, "#retry"));
        conversation.setAssignedUserId(ASSIGNED_USER_ID);
        conversations.save(conversation);
        Message failed = seedMessage(conversation.getId(), MessageStatus.FAILED);
        DeadLetterQueueEntry entry = new DeadLetterQueueEntry(UUID.randomUUID(),
                failed.getId(), conversation.getId(), "{}", "delivery_timeout", 3, "timeout",
                java.time.LocalDateTime.now().plusDays(7));
        dlq.save(entry);
        String assignedAuth = bearer(ASSIGNED_USER);
        String otherAuth = bearer(OTHER_USER);

        // Unassigned user denied (assignment-based authorization).
        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/messages/"
                        + failed.getId() + "/retry").header("Authorization", otherAuth))
                .andExpect(status().isForbidden());

        // Assigned user retries exactly once.
        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/messages/"
                        + failed.getId() + "/retry").header("Authorization", assignedAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(failed.getId().toString()));

        // Second attempt rejected: already retried (400).
        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/messages/"
                        + failed.getId() + "/retry").header("Authorization", assignedAuth))
                .andExpect(status().isBadRequest());

        // Sent messages are not retryable (400).
        Message sent = seedMessage(conversation.getId(), MessageStatus.SENT);
        mockMvc.perform(post("/api/conversations/" + conversation.getId() + "/messages/"
                        + sent.getId() + "/retry").header("Authorization", bearer(SUPER)))
                .andExpect(status().isBadRequest());
    }

    /**
     * MIG-073 TM-011 remediation (issue #442): the send path enforces the
     * assignment-bound {@code user}-role reply policy at the controller —
     * assigned USER succeeds with the unchanged frozen wire, an unassigned
     * USER is denied 403 before any persistence/dispatch side effect,
     * privileged roles and the existence 404 semantics are unchanged.
     */
    @Test
    void sendRequiresAssignmentForUserRole() throws Exception {
        seedActors();
        seedUser("00000000-0000-0000-0000-00000000a203", ADMIN, UserRole.ADMIN,
                UserStatus.ACTIVE);
        seedUser("00000000-0000-0000-0000-00000000a204", MANAGER, UserRole.MANAGER,
                UserStatus.ACTIVE);
        Conversation assigned = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, "chat-send-assigned"));
        assigned.setAssignedUserId(ASSIGNED_USER_ID);
        conversations.save(assigned);
        Conversation otherAssignee = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, "chat-send-other-assignee"));
        otherAssignee.setAssignedUserId(OTHER_USER_ID);
        conversations.save(otherAssignee);
        Conversation unassigned = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, "chat-send-unassigned"));
        long rowsBefore = messages.count();
        String assignedAuth = bearer(ASSIGNED_USER);
        String otherAuth = bearer(OTHER_USER);

        // Assigned USER succeeds — the frozen 201 {data} envelope with
        // pending/outbound status is unchanged (AC-1; product Story 1.3
        // "Reply on conversation ✅ (if assigned)").
        String response = mockMvc.perform(
                        post("/api/conversations/" + assigned.getId() + "/messages")
                                .header("Authorization", assignedAuth)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(mapper.createObjectNode()
                                        .put("body", "assigned reply").toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("pending"))
                .andExpect(jsonPath("$.data.direction").value("outbound"))
                .andReturn().getResponse().getContentAsString();
        assertThat(mapper.readTree(response).get("data").get("id")).isNotNull();
        assertThat(messages.count()).isEqualTo(rowsBefore + 1);

        // Unassigned USER denied with the pinned 403 {error} body — both the
        // other-assignee and the unassigned variant (AC-2). The guard runs
        // before MessageService.send, so no Message row is persisted and no
        // MessageCreatedEvent (the MIG-062 dispatch trigger) is published;
        // the unchanged row count below is the observable side-effect proof.
        String forbidden = "You do not have permission to send messages to this conversation";
        mockMvc.perform(post("/api/conversations/" + otherAssignee.getId() + "/messages")
                        .header("Authorization", assignedAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("body", "denied").toString()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value(forbidden));
        mockMvc.perform(post("/api/conversations/" + unassigned.getId() + "/messages")
                        .header("Authorization", assignedAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("body", "denied").toString()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value(forbidden));
        assertThat(messages.count()).isEqualTo(rowsBefore + 1);

        // Privileged roles unchanged: 201 on another assignee's conversation
        // and on an unassigned conversation (AC-3).
        String[] privilegedAuths = {bearer(SUPER), bearer(ADMIN), bearer(MANAGER)};
        for (String auth : privilegedAuths) {
            mockMvc.perform(post("/api/conversations/" + otherAssignee.getId() + "/messages")
                            .header("Authorization", auth)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.createObjectNode()
                                    .put("body", "privileged reply").toString()))
                    .andExpect(status().isCreated());
            mockMvc.perform(post("/api/conversations/" + unassigned.getId() + "/messages")
                            .header("Authorization", auth)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.createObjectNode()
                                    .put("body", "privileged reply").toString()))
                    .andExpect(status().isCreated());
        }
        assertThat(messages.count()).isEqualTo(rowsBefore + 7);

        // Existence 404 precedence preserved for every role (AC-4): an
        // unassigned USER and a privileged role on a missing conversation
        // get 404 {Conversation not found}, not 403.
        String missing = "/api/conversations/" + UUID.randomUUID() + "/messages";
        mockMvc.perform(post(missing)
                        .header("Authorization", otherAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("body", "denied").toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Conversation not found"));
        mockMvc.perform(post(missing)
                        .header("Authorization", privilegedAuths[0])
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("body", "privileged").toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Conversation not found"));
        assertThat(messages.count()).isEqualTo(rowsBefore + 7);
    }

    @Test
    void statusLookupAndMissingConversation() throws Exception {
        seedActors();
        Conversation conversation = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.IRC, "#status"));
        Message message = seedMessage(conversation.getId(), MessageStatus.FAILED);
        String auth = bearer(SUPER);

        mockMvc.perform(get("/api/conversations/" + conversation.getId() + "/messages/"
                        + message.getId() + "/status").header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messageId").value(message.getId().toString()))
                .andExpect(jsonPath("$.status").value("failed"));

        mockMvc.perform(get("/api/conversations/" + UUID.randomUUID() + "/messages")
                        .header("Authorization", auth))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Conversation not found"));
    }
}
