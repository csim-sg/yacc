package com.yacc.api.conversation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.fasterxml.jackson.databind.JsonNode;
import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.entity.ChannelType;
import com.yacc.entity.Conversation;
import com.yacc.entity.ConversationPriority;
import com.yacc.entity.ConversationStatus;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.repository.ConversationRepository;

/**
 * MIG-091d-fix wire pin (frozen contract {@code listConversations}; ADR-023,
 * canonicalization §1.5 "lowercase on the wire"): the {@code status} and
 * {@code priority} query filters bind the exact lowercase PostgreSQL labels
 * through the enums' {@code fromLabel} creator — every frozen label is
 * accepted (200 + correct filtering) while the Java constant names and any
 * other casing stay 400 (parity, no case superset).
 */
class ConversationListEnumQueryLabelIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUPER = "super-admin-convlabels@fixture.yacc.local";
    private static final String SUPER_ID = "00000000-0000-0000-0000-00000000a001";

    @Autowired
    private ConversationRepository conversations;

    /**
     * Orthogonal status × priority fixtures: each frozen status and each
     * frozen priority label matches a distinct, assertable row subset.
     */
    private List<Conversation> seedStatusAndPriorityFixtures() {
        return List.of(
                saveWith(UUID.randomUUID(), ConversationStatus.OPEN, ConversationPriority.LOW),
                saveWith(UUID.randomUUID(), ConversationStatus.PENDING, ConversationPriority.NORMAL),
                saveWith(UUID.randomUUID(), ConversationStatus.RESOLVED, ConversationPriority.HIGH),
                saveWith(UUID.randomUUID(), ConversationStatus.OPEN, ConversationPriority.URGENT));
    }

    private Conversation saveWith(UUID id, ConversationStatus status, ConversationPriority priority) {
        Conversation conversation = new Conversation(id, ChannelType.IRC, "#label-fixture-" + status.getLabel());
        conversation.setStatus(status);
        conversation.setPriority(priority);
        return conversations.save(conversation);
    }

    /** Lists with the given query string and returns the ids on the wire. */
    private Set<String> listedIds(String queryString, String auth) throws Exception {
        JsonNode body = mapper.readTree(mockMvc.perform(get("/api/conversations" + queryString)
                        .header("Authorization", auth))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        Set<String> ids = new HashSet<>();
        body.get("data").forEach(item -> ids.add(item.get("id").asText()));
        assertThat(ids.size()).isEqualTo(body.get("total").asInt());
        return ids;
    }

    @Test
    void everyFrozenStatusLabelBindsAndFilters() throws Exception {
        seedUser(SUPER_ID, SUPER, UserRole.SUPER_ADMIN, UserStatus.ACTIVE);
        List<Conversation> fixtures = seedStatusAndPriorityFixtures();
        String auth = bearer(SUPER);

        for (ConversationStatus status : ConversationStatus.values()) {
            Set<String> expected = fixtures.stream()
                    .filter(conversation -> conversation.getStatus() == status)
                    .map(conversation -> conversation.getId().toString())
                    .collect(Collectors.toSet());
            assertThat(listedIds("?status=" + status.getLabel(), auth))
                    .as("filter ?status=%s", status.getLabel())
                    .containsExactlyInAnyOrderElementsOf(expected);
        }
    }

    @Test
    void everyFrozenPriorityLabelBindsAndFilters() throws Exception {
        seedUser(SUPER_ID, SUPER, UserRole.SUPER_ADMIN, UserStatus.ACTIVE);
        List<Conversation> fixtures = seedStatusAndPriorityFixtures();
        String auth = bearer(SUPER);

        for (ConversationPriority priority : ConversationPriority.values()) {
            Set<String> expected = fixtures.stream()
                    .filter(conversation -> conversation.getPriority() == priority)
                    .map(conversation -> conversation.getId().toString())
                    .collect(Collectors.toSet());
            assertThat(listedIds("?priority=" + priority.getLabel(), auth))
                    .as("filter ?priority=%s", priority.getLabel())
                    .containsExactlyInAnyOrderElementsOf(expected);
        }
    }

    /** Contract parity direction: enum names and unknown values stay 400. */
    @Test
    void nonLabelStatusAndPriorityFormsStay400() throws Exception {
        seedUser(SUPER_ID, SUPER, UserRole.SUPER_ADMIN, UserStatus.ACTIVE);
        seedStatusAndPriorityFixtures();
        String auth = bearer(SUPER);

        mockMvc.perform(get("/api/conversations").param("status", "OPEN")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Validation error"));
        mockMvc.perform(get("/api/conversations").param("status", "Open")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/conversations").param("priority", "HIGH")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/conversations").param("priority", "nope")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest());
    }
}
