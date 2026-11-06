package com.yacc.api.conversation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.entity.ChannelType;
import com.yacc.entity.Conversation;
import com.yacc.entity.ConversationPriority;
import com.yacc.entity.ConversationStatus;
import com.yacc.entity.Message;
import com.yacc.entity.MessageDirection;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.repository.ConversationRepository;
import com.yacc.repository.MessageRepository;

/**
 * MIG-091d offline QA-parity gap closure (#456): the conversation-list query
 * surface re-expressed from the QA-001 / QA-004 catalogs on the shared
 * Testcontainers/MockMvc harness (per-test rollback). One test per catalog
 * family — no orphan tests:
 *
 * <ul>
 *   <li>{@link #unauthenticatedListIsDeniedWith401} — QA-001 TC-001-002,
 *       QA-004 RBAC-INBOX-005;</li>
 *   <li>{@link #paginationHonorsCustomLimitPageOffsetTotalAndOutOfRangePages}
 *       — QA-001 TC-002-001..004, QA-004 HP-INBOX-001/EDGE-INBOX-002/SMOKE-007;</li>
 *   <li>{@link #filtersByChannelStatusPriorityAssigneeAndTheirCombinations} —
 *       QA-001 TC-003-001/TC-003-004 (+ the channel + assignee + status AND
 *       combination of TC-003-005), QA-004
 *       HP-INBOX-002/HP-INBOX-005/EDGE-INBOX-001/RBAC-INBOX-002..004
 *       (status/priority label binding itself is covered by the #465
 *       ConversationListEnumQueryLabelIntegrationTest — see the method
 *       javadoc);</li>
 *   <li>{@link #searchMatchesBodiesSendersAndThreadIdsCaseInsensitivelyAndReturnsEmptyWithoutMatches}
 *       — QA-001 TC-004-001..003, QA-004 SMOKE-014;</li>
 *   <li>{@link #dateRangeBoundsFilterOnLastActivityIncludingSingleSidedRanges}
 *       — QA-001 TC-005-001..003;</li>
 *   <li>{@link #sortingSupportsLastActivityDefaultCreatedAndPriorityInBothDirections}
 *       — QA-001 TC-006-001..003;</li>
 *   <li>{@link #invalidQueryParametersAreRejectedWith400} — QA-001
 *       TC-011-001..003, QA-004 EDGE-INBOX-003/004/005;</li>
 *   <li>{@link #statusUpdateEdgeCasesValidateTransitionInputAndAllowSameStatus}
 *       — QA-004 EDGE-CONV-001/002.</li>
 * </ul>
 *
 * <p>No production change: every behavior asserted here already exists in
 * {@code ConversationService}/{@code ConversationsController} (frozen
 * contract op {@code listConversations}, ledger REST-CONV-001..003).</p>
 */
class ConversationListQueryApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUPER = "super-admin-list@fixture.yacc.local";
    private static final String MANAGER = "manager-list@fixture.yacc.local";
    private static final String MANAGER_ID = "00000000-0000-0000-0000-00000000e002";
    private static final String OTHER_MANAGER_ID = "00000000-0000-0000-0000-00000000e003";

    @Autowired
    private ConversationRepository conversations;

    @Autowired
    private MessageRepository messages;

    private void seedActors() {
        seedUser("00000000-0000-0000-0000-00000000e001", SUPER, UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE);
        seedUser(MANAGER_ID, MANAGER, UserRole.MANAGER, UserStatus.ACTIVE);
        seedUser(OTHER_MANAGER_ID, "manager2-list@fixture.yacc.local", UserRole.MANAGER,
                UserStatus.ACTIVE);
    }

    private Conversation seedConversation(ChannelType channel, String threadId) {
        return conversations.save(new Conversation(UUID.randomUUID(), channel, threadId));
    }

    private void shapeConversation(Conversation conversation, ConversationStatus status,
            ConversationPriority priority, String assignedUserId, LocalDateTime lastActivityAt) {
        conversation.setStatus(status);
        conversation.setPriority(priority);
        conversation.setAssignedUserId(assignedUserId);
        conversation.setLastActivityAt(lastActivityAt);
        conversations.save(conversation);
    }

    private Message seedInboundMessage(UUID conversationId, String senderName, String body) {
        return messages.save(new Message(UUID.randomUUID(), conversationId, null,
                senderName, body, MessageDirection.INBOUND));
    }

    private List<String> listedIds(String query, String authEmail) throws Exception {
        var result = mockMvc.perform(get("/api/conversations" + query)
                        .header("Authorization", bearer(authEmail)))
                .andReturn();
        org.assertj.core.api.Assertions.assertThat(result.getResponse().getStatus())
                .as("list query %s failed: %s", query, result.getResponse()
                        .getContentAsString())
                .isEqualTo(200);
        List<String> ids = new ArrayList<>();
        for (var item : mapper.readTree(result.getResponse().getContentAsString()).get("data")) {
            ids.add(item.get("id").asText());
        }
        return ids;
    }

    /** QA-001 TC-001-002, QA-004 RBAC-INBOX-005: no token → 401 {error}. */
    @Test
    void unauthenticatedListIsDeniedWith401() throws Exception {
        mockMvc.perform(get("/api/conversations"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    /**
     * QA-001 TC-002-001..004 (custom limit, page offset, total, out-of-range
     * page); QA-004 HP-INBOX-001, EDGE-INBOX-002, SMOKE-007.
     */
    @Test
    void paginationHonorsCustomLimitPageOffsetTotalAndOutOfRangePages() throws Exception {
        seedActors();
        List<Conversation> seeded = new ArrayList<>();
        for (int i = 0; i < 7; i++) {
            seeded.add(seedConversation(ChannelType.IRC, "#page-" + i));
        }

        // Custom limit: 10 returns all 7; 3 returns exactly 3 with total 7.
        String page1 = mockMvc.perform(get("/api/conversations?limit=3")
                        .header("Authorization", bearer(SUPER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(7))
                .andExpect(jsonPath("$.limit").value(3))
                .andExpect(jsonPath("$.page").value(1))
                .andReturn().getResponse().getContentAsString();
        assertThat(mapper.readTree(page1).get("data").size()).isEqualTo(3);

        // Page offset: page 2 returns different conversations than page 1.
        List<String> first = listedIds("?limit=3&page=1", SUPER);
        List<String> second = listedIds("?limit=3&page=2", SUPER);
        assertThat(first).doesNotContainAnyElementsOf(second);
        assertThat(listedIds("?limit=10", SUPER)).hasSize(7);
        mockMvc.perform(get("/api/conversations?limit=5")
                        .header("Authorization", bearer(SUPER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(5))
                .andExpect(jsonPath("$.limit").value(5));

        // Out-of-range page: graceful empty page with preserved totals.
        mockMvc.perform(get("/api/conversations?limit=3&page=100")
                        .header("Authorization", bearer(SUPER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty())
                .andExpect(jsonPath("$.total").value(7))
                .andExpect(jsonPath("$.page").value(100));
    }

    /**
     * QA-001 TC-003-001 and TC-003-004; QA-004 HP-INBOX-002/HP-INBOX-005,
     * EDGE-INBOX-001, RBAC-INBOX-002..004; the AND-combination substance of
     * TC-003-005/HP-INBOX-006/SMOKE-008 (channel + assignee pairings, plus
     * {@code status} in the three-filter combination): channel, assignee and
     * status filters, their combinations, and the empty intersection.
     *
     * <p>FINDING F1 (#456) — RESOLVED: at the original slice head the
     * {@code status} and {@code priority} list filters rejected every
     * contract-valid lowercase label (Spring bound the enum-typed request
     * params via case-sensitive {@code valueOf}), so this test combined only
     * channel + assignee. That product gap vs the frozen contract (ledger
     * REST-CONV-001 "identical filter set") was fixed by #465 / PR #466
     * (merged to {@code dev} at {@code 2dbb4a9}) via
     * {@code EnumQueryBindingConfig}, which binds the four enum query params
     * through the enums' {@code fromLabel} creators. The three-filter
     * combination below now runs on the contract-conformant lowercase
     * {@code status=open} label; label-level binding/filtering itself is
     * pinned by {@code ConversationListEnumQueryLabelIntegrationTest}
     * (#465).</p>
     */
    @Test
    void filtersByChannelStatusPriorityAssigneeAndTheirCombinations() throws Exception {
        seedActors();
        Conversation tgOpenHighManager = seedConversation(ChannelType.TELEGRAM, "chat-tg-1");
        shapeConversation(tgOpenHighManager, ConversationStatus.OPEN,
                ConversationPriority.HIGH, MANAGER_ID,
                LocalDateTime.of(2026, 3, 1, 10, 0));
        Conversation tgPendingUrgentOther = seedConversation(ChannelType.TELEGRAM, "chat-tg-2");
        shapeConversation(tgPendingUrgentOther, ConversationStatus.PENDING,
                ConversationPriority.URGENT, OTHER_MANAGER_ID,
                LocalDateTime.of(2026, 3, 2, 10, 0));
        Conversation ircResolvedLowManager = seedConversation(ChannelType.IRC, "#irc-1");
        shapeConversation(ircResolvedLowManager, ConversationStatus.RESOLVED,
                ConversationPriority.LOW, MANAGER_ID,
                LocalDateTime.of(2026, 3, 3, 10, 0));
        Conversation ircOpenNormalNone = seedConversation(ChannelType.IRC, "#irc-2");
        shapeConversation(ircOpenNormalNone, ConversationStatus.OPEN,
                ConversationPriority.NORMAL, null,
                LocalDateTime.of(2026, 3, 4, 10, 0));
        String tgPending = tgPendingUrgentOther.getId().toString();

        // Channel filter (TC-003-001 / HP-INBOX-002).
        assertThat(listedIds("?channel=telegram", SUPER)).containsExactlyInAnyOrder(
                tgOpenHighManager.getId().toString(), tgPending);
        assertThat(listedIds("?channel=irc", SUPER)).containsExactlyInAnyOrder(
                ircResolvedLowManager.getId().toString(), ircOpenNormalNone.getId().toString());

        // Assignee filter (TC-003-004 / HP-INBOX-005).
        assertThat(listedIds("?assignedUserId=" + MANAGER_ID, SUPER))
                .containsExactlyInAnyOrder(tgOpenHighManager.getId().toString(),
                        ircResolvedLowManager.getId().toString());

        // Combined AND logic on contract-conformant filters (TC-003-005 /
        // HP-INBOX-006 / SMOKE-008) and the three-filter channel + assignee +
        // status intersection → total 0 (EDGE-INBOX-001). Status and assignee
        // are load-bearing in that combination: dropping status yields the
        // pending telegram row and dropping assignee yields the open telegram
        // row (each exactly 1), while the full combination yields 0 (the
        // channel member's load-bearing behavior is asserted by the two
        // channel-only queries above).
        assertThat(listedIds("?channel=telegram&assignedUserId=" + OTHER_MANAGER_ID, SUPER))
                .containsExactly(tgPending);
        assertThat(listedIds("?channel=telegram&assignedUserId=" + MANAGER_ID, SUPER))
                .containsExactly(tgOpenHighManager.getId().toString());
        // Dropping the assignee member instead: the channel + status pair
        // (lowercase label) proves the positive channel + status intersection.
        assertThat(listedIds("?channel=telegram&status=open", SUPER))
                .containsExactly(tgOpenHighManager.getId().toString());
        mockMvc.perform(get("/api/conversations?channel=telegram&assignedUserId="
                        + OTHER_MANAGER_ID + "&status=open")
                        .header("Authorization", bearer(SUPER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));

        // Role-independent reads: the manager sees the same full set
        // (RBAC-INBOX-002; admin/super_admin identical per contract).
        assertThat(listedIds("", MANAGER)).hasSize(4);
    }

    /**
     * QA-001 TC-004-001..003; QA-004 SMOKE-014: case-insensitive search
     * across message bodies and sender names (Java also matches title/thread
     * id), and the empty result for a non-matching term.
     */
    @Test
    void searchMatchesBodiesSendersAndThreadIdsCaseInsensitivelyAndReturnsEmptyWithoutMatches()
            throws Exception {
        seedActors();
        Conversation bodyMatch = seedConversation(ChannelType.TELEGRAM, "chat-search-1");
        seedInboundMessage(bodyMatch.getId(), "Bob Customer", "please refund order 42");
        Conversation senderMatch = seedConversation(ChannelType.TELEGRAM, "chat-search-2");
        seedInboundMessage(senderMatch.getId(), "Refund Desk Alice", "hello there");
        Conversation threadMatch = seedConversation(ChannelType.IRC, "refund-case-9");
        seedInboundMessage(threadMatch.getId(), "Carol", "unrelated body");
        Conversation noMatch = seedConversation(ChannelType.IRC, "chat-search-4");
        seedInboundMessage(noMatch.getId(), "Carol", "welcome aboard");

        String lower = String.join(",",
                listedIds("?search=refund", SUPER));
        String upper = String.join(",",
                listedIds("?search=REFUND", SUPER));
        assertThat(upper).isEqualTo(lower);
        assertThat(lower).contains(
                bodyMatch.getId().toString(),
                senderMatch.getId().toString(),
                threadMatch.getId().toString());
        assertThat(lower).doesNotContain(noMatch.getId().toString());

        // Sender-name search, case-insensitive (TC-004-002).
        assertThat(listedIds("?search=alice", SUPER))
                .containsExactly(senderMatch.getId().toString());
        assertThat(listedIds("?search=Alice", SUPER))
                .containsExactly(senderMatch.getId().toString());

        // No matches → empty data + total 0 (TC-004-003).
        mockMvc.perform(get("/api/conversations?search=xyznonexistentstring")
                        .header("Authorization", bearer(SUPER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty())
                .andExpect(jsonPath("$.total").value(0));
    }

    /**
     * QA-001 TC-005-001..003: dateFrom/dateTo window and the single-sided
     * variants, bound inclusively on {@code lastActivityAt}.
     */
    @Test
    void dateRangeBoundsFilterOnLastActivityIncludingSingleSidedRanges() throws Exception {
        seedActors();
        Conversation january = seedConversation(ChannelType.TELEGRAM, "chat-date-1");
        shapeConversation(january, ConversationStatus.OPEN, ConversationPriority.NORMAL,
                null, LocalDateTime.of(2026, 1, 10, 10, 0));
        Conversation february = seedConversation(ChannelType.TELEGRAM, "chat-date-2");
        shapeConversation(february, ConversationStatus.OPEN, ConversationPriority.NORMAL,
                null, LocalDateTime.of(2026, 2, 1, 8, 0));
        Conversation march = seedConversation(ChannelType.TELEGRAM, "chat-date-3");
        shapeConversation(march, ConversationStatus.OPEN, ConversationPriority.NORMAL,
                null, LocalDateTime.of(2026, 3, 15, 12, 0));

        // Full window: only February inside [2026-02-01, 2026-03-01).
        assertThat(listedIds("?dateFrom=2026-02-01&dateTo=2026-03-01", SUPER))
                .containsExactly(february.getId().toString());
        // dateFrom only: February and March.
        assertThat(listedIds("?dateFrom=2026-02-01", SUPER)).containsExactlyInAnyOrder(
                february.getId().toString(), march.getId().toString());
        // dateTo only: January and February.
        assertThat(listedIds("?dateTo=2026-03-01", SUPER)).containsExactlyInAnyOrder(
                january.getId().toString(), february.getId().toString());
    }

    /**
     * QA-001 TC-006-001..003: default sort is lastActivity DESC;
     * sortBy=created works in both directions; sortBy=priority follows the
     * native PostgreSQL enum order (low &lt; normal &lt; high &lt; urgent) —
     * the same semantics as the Node {@code desc(conversations.priority)}
     * PG-enum sort. Timestamp-collision note: created-at values are written
     * by sequential container round-trips (microsecond resolution), so the
     * strict reverse-order assertion is deterministic by construction.
     */
    @Test
    void sortingSupportsLastActivityDefaultCreatedAndPriorityInBothDirections() throws Exception {
        seedActors();
        Conversation early = seedConversation(ChannelType.IRC, "#sort-latest-1");
        shapeConversation(early, ConversationStatus.OPEN, ConversationPriority.NORMAL,
                null, LocalDateTime.of(2026, 1, 5, 9, 0));
        Conversation latest = seedConversation(ChannelType.IRC, "#sort-latest-2");
        shapeConversation(latest, ConversationStatus.OPEN, ConversationPriority.NORMAL,
                null, LocalDateTime.of(2026, 3, 9, 9, 0));
        Conversation middle = seedConversation(ChannelType.IRC, "#sort-latest-3");
        shapeConversation(middle, ConversationStatus.OPEN, ConversationPriority.NORMAL,
                null, LocalDateTime.of(2026, 2, 7, 9, 0));

        // Default (no params) = lastActivityAt DESC (TC-006-001).
        assertThat(listedIds("", SUPER)).containsExactly(
                latest.getId().toString(), middle.getId().toString(),
                early.getId().toString());

        // Priority sort follows the PG enum order in both directions
        // (TC-006-003). Only the four distinctly-prioritized conversations are
        // compared: the three lastActivity seeds share NORMAL priority, so
        // their relative order among equal keys is not asserted.
        Conversation low = seedConversation(ChannelType.IRC, "#sort-prio-1");
        shapeConversation(low, ConversationStatus.OPEN, ConversationPriority.LOW,
                null, LocalDateTime.of(2026, 2, 1, 9, 0));
        Conversation normal = seedConversation(ChannelType.IRC, "#sort-prio-2");
        shapeConversation(normal, ConversationStatus.OPEN, ConversationPriority.NORMAL,
                null, LocalDateTime.of(2026, 2, 2, 9, 0));
        Conversation high = seedConversation(ChannelType.IRC, "#sort-prio-3");
        shapeConversation(high, ConversationStatus.OPEN, ConversationPriority.HIGH,
                null, LocalDateTime.of(2026, 2, 3, 9, 0));
        Conversation urgent = seedConversation(ChannelType.IRC, "#sort-prio-4");
        shapeConversation(urgent, ConversationStatus.OPEN, ConversationPriority.URGENT,
                null, LocalDateTime.of(2026, 2, 4, 9, 0));
        List<String> priorityFamily = java.util.List.of(
                low.getId().toString(), normal.getId().toString(),
                high.getId().toString(), urgent.getId().toString());
        List<String> descFiltered = new ArrayList<>(listedIds("?sortBy=priority&sortOrder=desc", SUPER));
        descFiltered.retainAll(priorityFamily);
        assertThat(descFiltered).containsExactly(
                urgent.getId().toString(), high.getId().toString(),
                normal.getId().toString(), low.getId().toString());
        List<String> ascFiltered = new ArrayList<>(listedIds("?sortBy=priority&sortOrder=asc", SUPER));
        ascFiltered.retainAll(priorityFamily);
        assertThat(ascFiltered).containsExactly(
                low.getId().toString(), normal.getId().toString(),
                high.getId().toString(), urgent.getId().toString());

        // Created sort in both directions (TC-006-002): all seven seeded
        // conversations; desc is the exact reverse of asc.
        List<String> createdAsc = listedIds("?sortBy=created&sortOrder=asc", SUPER);
        List<String> createdDesc = listedIds("?sortBy=created&sortOrder=desc", SUPER);
        assertThat(createdAsc).hasSize(7);
        java.util.Collections.reverse(createdAsc);
        assertThat(createdDesc).isEqualTo(createdAsc);
    }

    /**
     * QA-001 TC-011-001..003; QA-004 EDGE-INBOX-003/004/005: invalid query
     * parameters are rejected with the frozen 400 {error} shape.
     */
    @Test
    void invalidQueryParametersAreRejectedWith400() throws Exception {
        seedActors();
        String auth = bearer(SUPER);

        // Invalid channel (TC-011-001).
        mockMvc.perform(get("/api/conversations?channel=invalid_channel")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("Invalid query: channel must be one of telegram, irc"));

        // Invalid date (TC-011-002).
        mockMvc.perform(get("/api/conversations?dateFrom=invalid-date")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("Invalid query: dateFrom must be an ISO date"));

        // Non-numeric limit → conversion 400 (TC-011-003).
        mockMvc.perform(get("/api/conversations?limit=abc")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
        // Out-of-bound limits (EDGE-INBOX-003) and pages.
        mockMvc.perform(get("/api/conversations?limit=0")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("Invalid query: limit must be an integer between 1 and 100"));
        mockMvc.perform(get("/api/conversations?limit=150")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("Invalid query: limit must be an integer between 1 and 100"));
        mockMvc.perform(get("/api/conversations?page=0")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error")
                        .value("Invalid query: page must be a positive integer"));

        // Invalid status / legacy priority labels → 400 (EDGE-INBOX-004/005).
        // The contract-valid lowercase labels now bind through the enum label
        // editors registered by #465 (EnumQueryBindingConfig) and are
        // asserted in ConversationListEnumQueryLabelIntegrationTest; the two
        // values below are genuine non-labels — `invalid` is not a frozen
        // status label and `medium` is not a frozen priority label — so both
        // stay invalid-value 400s.
        mockMvc.perform(get("/api/conversations?status=invalid")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
        mockMvc.perform(get("/api/conversations?priority=medium")
                        .header("Authorization", auth))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());
    }

    /**
     * QA-004 EDGE-CONV-001/002: an invalid status body is rejected with 400,
     * and the same-status transition is an idempotent 200.
     */
    @Test
    void statusUpdateEdgeCasesValidateTransitionInputAndAllowSameStatus() throws Exception {
        seedActors();
        Conversation conversation = seedConversation(ChannelType.IRC, "#edge-status");

        // Invalid status value → 400 validation error (EDGE-CONV-001).
        mockMvc.perform(patch("/api/conversations/" + conversation.getId() + "/status")
                        .header("Authorization", bearer(SUPER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("status", "invalid").toString()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").isNotEmpty());

        // Same-status transition stays a 200 no-op (EDGE-CONV-002).
        mockMvc.perform(patch("/api/conversations/" + conversation.getId() + "/status")
                        .header("Authorization", bearer(SUPER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode()
                                .put("status", "open").toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("open"));
    }
}
