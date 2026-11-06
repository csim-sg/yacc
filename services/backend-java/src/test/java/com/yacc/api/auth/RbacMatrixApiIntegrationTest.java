package com.yacc.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.LocalDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.yacc.common.testsupport.AbstractApiIntegrationTest;
import com.yacc.entity.AuditLog;
import com.yacc.entity.ChannelType;
import com.yacc.entity.Conversation;
import com.yacc.entity.DeadLetterQueueEntry;
import com.yacc.entity.Message;
import com.yacc.entity.MessageDirection;
import com.yacc.entity.MessageStatus;
import com.yacc.entity.Notification;
import com.yacc.entity.Tag;
import com.yacc.entity.User;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.repository.AuditLogRepository;
import com.yacc.repository.ConversationRepository;
import com.yacc.repository.DeadLetterQueueEntryRepository;
import com.yacc.repository.MessageRepository;
import com.yacc.repository.NotificationRepository;
import com.yacc.repository.TagRepository;

/**
 * AC-11 four-role matrix walk (.docs/qa/rbac-coverage-matrix.md; #366
 * AC-MIG-091-2; issue #457). This class closes the role cells the existing
 * per-feature suites leave unproven — every role-gated REST operation is
 * exercised for all four roles through the real filter chain with explicit
 * per-role fixtures (fresh stateful fixture per role call keeps every
 * expected status deterministic; no ordering dependence between roles).
 * Deep wire behavior stays pinned by the per-feature suites; this class
 * asserts the RBAC outcome (allow vs 403) per cell.
 *
 * <p>Shared axes are covered elsewhere and cited by the matrix: anonymous
 * (one method here + {@code AuthFlowIntegrationTest#protectedSurfaceRequiresAToken})
 * and inactive/suspended (the shared {@code BearerTokenAuthenticationConverter}
 * seam — {@code RbacStatusDenialIntegrationTest}).</p>
 */
class RbacMatrixApiIntegrationTest extends AbstractApiIntegrationTest {

    private static final String SUPER = "matrix-super@fixture.yacc.local";
    private static final String ADMIN = "matrix-admin@fixture.yacc.local";
    private static final String MANAGER = "matrix-manager@fixture.yacc.local";
    private static final String USER = "matrix-user@fixture.yacc.local";
    private static final String SUPER_ID = "00000000-0000-0000-0000-00000000e101";
    private static final String ADMIN_ID = "00000000-0000-0000-0000-00000000e102";
    private static final String MANAGER_ID = "00000000-0000-0000-0000-00000000e103";
    private static final String USER_ID = "00000000-0000-0000-0000-00000000e104";

    @Autowired
    private ConversationRepository conversations;
    @Autowired
    private MessageRepository messages;
    @Autowired
    private DeadLetterQueueEntryRepository dlq;
    @Autowired
    private TagRepository tags;
    @Autowired
    private AuditLogRepository auditLogs;
    @Autowired
    private NotificationRepository notifications;

    private void seedRoles() {
        seedUser(SUPER_ID, SUPER, UserRole.SUPER_ADMIN, UserStatus.ACTIVE);
        seedUser(ADMIN_ID, ADMIN, UserRole.ADMIN, UserStatus.ACTIVE);
        seedUser(MANAGER_ID, MANAGER, UserRole.MANAGER, UserStatus.ACTIVE);
        seedUser(USER_ID, USER, UserRole.USER, UserStatus.ACTIVE);
    }

    private String auth(UserRole role) {
        return bearer(switch (role) {
                case SUPER_ADMIN -> SUPER;
                case ADMIN -> ADMIN;
                case MANAGER -> MANAGER;
                case USER -> USER;
        });
    }

    private UserRole[] allRoles() {
        return new UserRole[] {UserRole.SUPER_ADMIN, UserRole.ADMIN,
                UserRole.MANAGER, UserRole.USER};
    }

    /** Asserts the exact status; role gate denials are always 403. */
    private void expect(UserRole role, String method, String url, String body, int expected)
            throws Exception {
        mockMvc.perform(request(method, url)
                        .header("Authorization", auth(role))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body == null ? "" : body))
                .andExpect(status(expected));
    }

    /** Deny cells assert the exact 403; the super_admin allow cell proves
     * the gate passed (its deep outcome depends on external IRC
     * connectivity, so only the absence of the role denial is asserted). */
    private void expectIrcTest(UserRole role, String url) throws Exception {
        if (role == UserRole.SUPER_ADMIN) {
            var result = mockMvc.perform(request("POST", url)
                            .header("Authorization", auth(role))
                            .contentType(MediaType.APPLICATION_JSON))
                    .andReturn();
            int status = result.getResponse().getStatus();
            assertThat(status).as("%s must pass the role gate (not 403)", url)
                    .isNotEqualTo(403);
        } else {
            expect(role, "POST", url, null, 403);
        }
    }

    private static MockHttpServletRequestBuilder request(String method, String url) {
        return switch (method) {
                case "GET" -> get(url);
                case "POST" -> post(url);
                case "PUT" -> put(url);
                case "PATCH" -> patch(url);
                case "DELETE" -> delete(url);
                default -> throw new IllegalArgumentException(method);
        };
    }

    private static ResultMatcher status(int expected) {
        return org.springframework.test.web.servlet.result.MockMvcResultMatchers
                .status().is(expected);
    }

    private Conversation conversation(String externalId) {
        return conversations.save(new Conversation(UUID.randomUUID(), ChannelType.TELEGRAM,
                externalId));
    }

    /** Failed inbound message + terminal DLQ row (fresh per role call). */
    private Message failedMessage(Conversation conversation) {
        Message message = messages.save(new Message(UUID.randomUUID(), conversation.getId(),
                null, "external-sender", "body", MessageDirection.INBOUND));
        message.setStatus(MessageStatus.FAILED);
        messages.save(message);
        dlq.save(new DeadLetterQueueEntry(UUID.randomUUID(), message.getId(),
                conversation.getId(), "{}", "delivery_timeout", 3, "boom",
                LocalDateTime.now().plusDays(7)));
        return message;
    }

    private String sendBody() {
        return mapper.createObjectNode().put("body", "matrix reply").toString();
    }

    private String bulkBody(Conversation conversation) {
        var node = mapper.createObjectNode();
        node.set("conversationIds", mapper.createArrayNode()
                .add(conversation.getId().toString()));
        node.put("action", "status");
        node.putObject("data").put("status", "pending");
        return node.toString();
    }

    private String assignBody(String assignedUserId) {
        return mapper.createObjectNode().put("assignedUserId", assignedUserId).toString();
    }

    private String tagBody(Tag tag) {
        return mapper.createObjectNode().put("tagId", tag.getId()).toString();
    }

    private String noteBody() {
        return mapper.createObjectNode().put("body", "matrix note").toString();
    }

    private String routingRuleBody(Tag tag) {
        var node = mapper.createObjectNode();
        node.put("name", "matrix-rule-" + UUID.randomUUID());
        node.put("priority", 10);
        node.put("status", "active");
        node.set("conditions", mapper.createArrayNode().addObject()
                .put("field", "keyword").put("operator", "contains").put("value", "urgent"));
        node.set("actions", mapper.createArrayNode().addObject()
                .put("type", "tag").put("value", tag.getId()));
        return node.toString();
    }

    private String ircConfigBody() {
        return mapper.createObjectNode()
                .put("server", "irc.fixture.local")
                .put("port", 6667)
                .put("username", "yaccbot")
                .put("password", "matrix-secret")
                .set("channels", mapper.createArrayNode().add("#matrix"))
                .toString();
    }

    private String ircProfileBody() {
        return mapper.createObjectNode()
                .put("name", "matrix-" + UUID.randomUUID())
                .put("server", "irc.fixture.local")
                .put("port", 6667)
                .put("nick", "matrixbot")
                .set("channels", mapper.createArrayNode().add("#matrix"))
                .toString();
    }

    // ------------------------------------------------------------------
    // Session surface — every active role on its own session (rows 12–14, 19)
    // ------------------------------------------------------------------

    @Test
    void sessionOperationsAllowEveryActiveRole() throws Exception {
        seedRoles();
        for (UserRole role : allRoles()) {
            String token = token(emailOf(role));
            mockMvc.perform(get("/api/auth/get-session")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status(200));
            mockMvc.perform(get("/api/users/roles")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status(200));
            mockMvc.perform(post("/api/auth/sign-out")
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status(200));
            // Fresh sign-in (new grant) then an own-credential change per role.
            String fresh = token(emailOf(role));
            mockMvc.perform(post("/api/auth/change-password")
                            .header("Authorization", "Bearer " + fresh)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.createObjectNode()
                                    .put("currentPassword", PASSWORD)
                                    .put("newPassword", "rotated-" + role.getLabel() + "-1")
                                    .toString()))
                    .andExpect(status(200));
        }
    }

    private String emailOf(UserRole role) {
        return switch (role) {
                case SUPER_ADMIN -> SUPER;
                case ADMIN -> ADMIN;
                case MANAGER -> MANAGER;
                case USER -> USER;
        };
    }

    // ------------------------------------------------------------------
    // Shared-inbox viewing rows 20/21/27/30/31/33 — all four roles, foreign
    // assignee + unassigned fixtures (2026-10-18 decision; §7 of the matrix)
    // ------------------------------------------------------------------

    @Test
    void sharedInboxViewingAllowsEveryActiveRole() throws Exception {
        seedRoles();
        Conversation foreign = conversation("matrix-view-foreign");
        foreign.setAssignedUserId(MANAGER_ID);
        conversations.save(foreign);
        Conversation unassigned = conversation("matrix-view-unassigned");
        Message foreignMessage = messages.save(new Message(UUID.randomUUID(),
                foreign.getId(), null, "external-sender", "body", MessageDirection.INBOUND));

        for (UserRole role : allRoles()) {
            mockMvc.perform(get("/api/conversations").header("Authorization", auth(role)))
                    .andExpect(status(200));
            mockMvc.perform(get("/api/conversations/" + foreign.getId())
                            .header("Authorization", auth(role)))
                    .andExpect(status(200));
            mockMvc.perform(get("/api/conversations/" + unassigned.getId())
                            .header("Authorization", auth(role)))
                    .andExpect(status(200));
            mockMvc.perform(get("/api/conversations/" + foreign.getId() + "/messages")
                            .header("Authorization", auth(role)))
                    .andExpect(status(200));
            mockMvc.perform(get("/api/conversations/" + foreign.getId() + "/messages/"
                            + foreignMessage.getId() + "/status")
                    .header("Authorization", auth(role)))
                    .andExpect(status(200));
            mockMvc.perform(get("/api/conversations/" + foreign.getId() + "/notes")
                            .header("Authorization", auth(role)))
                    .andExpect(status(200));
            mockMvc.perform(get("/api/tags").header("Authorization", auth(role)))
                    .andExpect(status(200));
        }
    }

    // ------------------------------------------------------------------
    // Conversation writes, rows 22–26 — status/priority manager+, PATCH
    // assign admin+, POST assign/bulk manager+ (fresh conversation per call)
    // ------------------------------------------------------------------

    @Test
    void conversationWritesFollowTheRoleMatrix() throws Exception {
        seedRoles();

        for (UserRole role : allRoles()) {
            int expected = role == UserRole.USER ? 403 : 200;
            expect(role, "PATCH", "/api/conversations/"
                    + conversation("st-" + role).getId() + "/status",
                    mapper.createObjectNode().put("status", "resolved").toString(), expected);
            expect(role, "PATCH", "/api/conversations/"
                    + conversation("pr-" + role).getId() + "/priority",
                    mapper.createObjectNode().put("priority", "urgent").toString(), expected);
            expect(role, "POST", "/api/conversations/"
                    + conversation("as-" + role).getId() + "/assign",
                    assignBody(MANAGER_ID), expected);
            expect(role, "POST", "/api/conversations/bulk",
                    bulkBody(conversation("bulk-" + role)), expected);
        }

        // PATCH-assign is the narrow admin+ gate: MANAGER denied.
        for (UserRole role : allRoles()) {
            int expected = role == UserRole.MANAGER || role == UserRole.USER ? 403 : 200;
            expect(role, "PATCH", "/api/conversations/"
                    + conversation("pa-" + role).getId() + "/assign",
                    assignBody(MANAGER_ID), expected);
        }
    }

    // ------------------------------------------------------------------
    // Message reply/retry + notes + tags — privileged allow cells; USER
    // assignment binding stays with MessageApiIntegrationTest (rows 28/29/32/34/35/36)
    // ------------------------------------------------------------------

    @Test
    void privilegedRolesPassTheReplyAndRetryGates() throws Exception {
        seedRoles();
        Tag tag = tags.save(new Tag("matrix-tag", "#123456", SUPER_ID));

        for (UserRole role : allRoles()) {
            // Reply on an unassigned conversation: privileged 201, USER 403.
            expect(role, "POST",
                    "/api/conversations/" + conversation("send-" + role).getId() + "/messages",
                    sendBody(), role == UserRole.USER ? 403 : 201);

            // Retry on an unassigned conversation: privileged 200, USER 403.
            Conversation retryConversation = conversation("retry-" + role);
            expect(role, "POST",
                    "/api/conversations/" + retryConversation.getId() + "/messages/"
                            + failedMessage(retryConversation).getId() + "/retry",
                    null, role == UserRole.USER ? 403 : 200);

            // Notes create: every role (GOV-021).
            expect(role, "POST",
                    "/api/conversations/" + conversation("note-" + role).getId() + "/notes",
                    noteBody(), 201);

            // Tag library create: every role (GOV-021).
            expect(role, "POST", "/api/tags",
                    mapper.createObjectNode().put("name", "role-" + role + "-tag")
                            .put("color", "#AA12BC").toString(),
                    201);

            // Conversation tag links: resource-scoped — privileged pass,
            // unassigned USER denied (canAccessConversation).
            Conversation linkConversation = conversation("link-" + role);
            expect(role, "POST", "/api/conversations/" + linkConversation.getId() + "/tags",
                    tagBody(tag), role == UserRole.USER ? 403 : 201);
            expect(role, "DELETE", "/api/conversations/" + linkConversation.getId()
                    + "/tags/" + tag.getId(), null, role == UserRole.USER ? 403 : 200);
        }
    }

    // ------------------------------------------------------------------
    // User administration rows 15–18 — super_admin only
    // ------------------------------------------------------------------

    @Test
    void userAdministrationIsSuperAdminOnly() throws Exception {
        seedRoles();

        for (UserRole role : allRoles()) {
            int expected = role == UserRole.SUPER_ADMIN ? 200 : 403;
            expect(role, "GET", "/api/users", null, expected);

            int createExpected = role == UserRole.SUPER_ADMIN ? 201 : 403;
            expect(role, "POST", "/api/users",
                    mapper.createObjectNode()
                            .put("email", "matrix-created-" + role.getLabel()
                                    + "@fixture.yacc.local")
                            .put("password", "created-identity-1")
                            .put("name", "Created " + role)
                            .put("role", "user")
                            .toString(),
                    createExpected);

            int updateExpected = role == UserRole.SUPER_ADMIN ? 200 : 403;
            expect(role, "PUT", "/api/users/" + MANAGER_ID,
                    mapper.createObjectNode().put("name", "Renamed Manager").toString(),
                    updateExpected);

            // Fresh soft-delete target per role call.
            User target = users.save(new User(UUID.randomUUID().toString(),
                    "matrix-target-" + role.getLabel() + "@fixture.yacc.local",
                    "Matrix Target", new BCryptPasswordEncoder().encode(PASSWORD),
                    UserRole.USER, UserStatus.ACTIVE, true));
            expect(role, "DELETE", "/api/users/" + target.getId(), null,
                    role == UserRole.SUPER_ADMIN ? 200 : 403);
        }
    }

    // ------------------------------------------------------------------
    // Routing rules rows 37–41 — manager+ reads, admin+ writes
    // ------------------------------------------------------------------

    @Test
    void routingRulesAreManagerReadAdminWrite() throws Exception {
        seedRoles();
        Tag tag = tags.save(new Tag("matrix-rules-tag", "#654321", SUPER_ID));

        for (UserRole role : allRoles()) {
            expect(role, "GET", "/api/routing-rules", null,
                    role == UserRole.USER ? 403 : 200);
            expect(role, "POST", "/api/routing-rules", routingRuleBody(tag),
                    role == UserRole.MANAGER || role == UserRole.USER ? 403 : 201);
        }

        // Mutations on a fresh rule per role (admin-created fixture).
        for (UserRole role : allRoles()) {
            String created = mockMvc.perform(post("/api/routing-rules")
                            .header("Authorization", bearer(ADMIN))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(routingRuleBody(tag)))
                    .andExpect(status(201))
                    .andReturn().getResponse().getContentAsString();
            String ruleId = mapper.readTree(created).get("data").get("id").asText();

            int writeExpected = role == UserRole.MANAGER || role == UserRole.USER ? 403 : 200;
            expect(role, "PATCH", "/api/routing-rules/" + ruleId,
                    mapper.createObjectNode().put("priority", 55).toString(), writeExpected);
            expect(role, "DELETE", "/api/routing-rules/" + ruleId, null, writeExpected);
        }

        // Executions read (manager+); empty log list is fine.
        String rule = mockMvc.perform(post("/api/routing-rules")
                        .header("Authorization", bearer(ADMIN))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(routingRuleBody(tag)))
                .andExpect(status(201))
                .andReturn().getResponse().getContentAsString();
        String ruleId = mapper.readTree(rule).get("data").get("id").asText();
        for (UserRole role : allRoles()) {
            expect(role, "GET", "/api/routing-rules/" + ruleId + "/executions", null,
                    role == UserRole.USER ? 403 : 200);
        }
    }

    // ------------------------------------------------------------------
    // Notifications rows 42–45 — every role, own scope
    // ------------------------------------------------------------------

    @Test
    void notificationOperationsAreOwnScopeForEveryRole() throws Exception {
        seedRoles();
        for (UserRole role : allRoles()) {
            String ownerId = switch (role) {
                    case SUPER_ADMIN -> SUPER_ID;
                    case ADMIN -> ADMIN_ID;
                    case MANAGER -> MANAGER_ID;
                    case USER -> USER_ID;
            };
            UUID id = UUID.randomUUID();
            notifications.save(new Notification(id, ownerId, "assignment", null,
                    SUPER_ID, "matrix notification"));

            mockMvc.perform(get("/api/notifications")
                            .header("Authorization", auth(role)))
                    .andExpect(status(200));
            mockMvc.perform(patch("/api/notifications/" + id)
                            .header("Authorization", auth(role))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(mapper.createObjectNode().put("isRead", true).toString()))
                    .andExpect(status(200));
            mockMvc.perform(delete("/api/notifications/" + id)
                            .header("Authorization", auth(role)))
                    .andExpect(status(204));
            mockMvc.perform(post("/api/notifications/mark-all-read")
                            .header("Authorization", auth(role)))
                    .andExpect(status(200));
        }
    }

    // ------------------------------------------------------------------
    // Audit rows 46–49 — manager+ reads, admin+ export
    // ------------------------------------------------------------------

    @Test
    void auditSurfaceIsManagerReadAdminExport() throws Exception {
        seedRoles();
        UUID conversationId = UUID.randomUUID();
        auditLogs.save(new AuditLog(UUID.randomUUID(), MANAGER_ID,
                "conversation_status_change", "conversation", conversationId, null));
        auditLogs.save(new AuditLog(UUID.randomUUID(), SUPER_ID, "conversation_assigned",
                "conversation", conversationId, null));

        for (UserRole role : allRoles()) {
            int readExpected = role == UserRole.USER ? 403 : 200;
            expect(role, "GET", "/api/conversations/" + conversationId + "/audit-logs",
                    null, readExpected);
            expect(role, "GET", "/api/audit-logs", null, readExpected);
            expect(role, "GET", "/api/audit-logs/conversations/" + conversationId,
                    null, readExpected);
            expect(role, "POST", "/api/audit-logs/export",
                    mapper.createObjectNode().put("format", "csv").toString(),
                    role == UserRole.MANAGER || role == UserRole.USER ? 403 : 200);
        }
    }

    // ------------------------------------------------------------------
    // DLQ rows 50–53 — manager+ reads, admin+ re-queue, super_admin delete
    // ------------------------------------------------------------------

    @Test
    void dlqSurfaceFollowsTheRoleMatrix() throws Exception {
        seedRoles();
        Conversation shared = conversation("dlq-shared");
        failedMessage(shared);

        for (UserRole role : allRoles()) {
            int readExpected = role == UserRole.USER ? 403 : 200;
            expect(role, "GET", "/api/dlq", null, readExpected);
            expect(role, "GET", "/api/dlq/stats", null, readExpected);

            // Fresh entry per role call; re-queue only marks, delete removes.
            Conversation fresh = conversation("dlq-" + role);
            Message failed = failedMessage(fresh);
            DeadLetterQueueEntry entry =
                    dlq.findByMessageId(failed.getId()).orElseThrow();
            expect(role, "POST", "/api/dlq/" + entry.getId() + "/re-queue", null,
                    role == UserRole.MANAGER || role == UserRole.USER ? 403 : 200);
            expect(role, "DELETE", "/api/dlq/" + entry.getId(), null,
                    role == UserRole.SUPER_ADMIN ? 200 : 403);
        }
    }

    // ------------------------------------------------------------------
    // Queue rows 54–61 — manager+ reads/retries, super_admin clear
    // ------------------------------------------------------------------

    @Test
    void queueSurfaceFollowsTheRoleMatrix() throws Exception {
        seedRoles();
        Conversation shared = conversation("queue-shared");
        Message sharedMessage = failedMessage(shared);

        for (UserRole role : allRoles()) {
            int readExpected = role == UserRole.USER ? 403 : 200;
            expect(role, "GET", "/api/queue/stats", null, readExpected);
            expect(role, "GET", "/api/queue/dlq", null, readExpected);
            expect(role, "GET", "/api/queue/dlq/stats", null, readExpected);
            expect(role, "GET", "/api/queue/job/" + sharedMessage.getId(), null, readExpected);
            expect(role, "GET", "/api/queue/dlq/by-reason/delivery_timeout", null, readExpected);
            expect(role, "POST", "/api/queue/dlq/retry",
                    mapper.createObjectNode().set("messageIds", mapper.createArrayNode()
                            .add(UUID.randomUUID().toString())).toString(),
                    readExpected);

            Conversation fresh = conversation("queue-" + role);
            Message freshMessage = failedMessage(fresh);
            expect(role, "POST", "/api/queue/retry/" + freshMessage.getId(), null,
                    role == UserRole.USER ? 403 : 200);
            expect(role, "POST", "/api/queue/dlq/clear/" + freshMessage.getId(), null,
                    role == UserRole.SUPER_ADMIN ? 200 : 403);
        }
    }

    // ------------------------------------------------------------------
    // IRC integration rows 62–65 — super_admin control plane, admin+ status
    // ------------------------------------------------------------------

    @Test
    void ircControlPlaneIsSuperAdminOnly() throws Exception {
        seedRoles();
        // Save the config once (super_admin) so connect/status/test have state.
        mockMvc.perform(post("/api/integrations/irc/config")
                        .header("Authorization", bearer(SUPER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ircConfigBody()))
                .andExpect(status(200));

        for (UserRole role : allRoles()) {
            expect(role, "POST", "/api/integrations/irc/config", ircConfigBody(),
                    role == UserRole.SUPER_ADMIN ? 200 : 403);
            // Connect: the non-super deny cells are asserted here (the role
            // gate rejects before any connection attempt); the super_admin
            // allow cell — and the connection-state lifecycle — stay pinned
            // by IrcApiIntegrationTest#configSaveConnect409TestAndStatus.
            // This walk deliberately never invokes connect with an allowed
            // role: IrcConnectionState is an in-memory singleton shared by
            // every test class on this context, and a connect here would
            // leak "retrying" into IrcApiIntegrationTest's "disconnected"
            // assertion (403 deny calls never reach the service).
            if (role != UserRole.SUPER_ADMIN) {
                expect(role, "POST", "/api/integrations/irc/connect", null, 403);
            }
            // The deep outcome depends on external IRC connectivity — the
            // super_admin allow cell proves the gate passed (not 403); wire
            // behavior stays pinned by IrcApiIntegrationTest.
            expectIrcTest(role, "/api/integrations/irc/test");
            expect(role, "GET", "/api/integrations/irc/status", null,
                    role == UserRole.MANAGER || role == UserRole.USER ? 403 : 200);
        }
    }

    // ------------------------------------------------------------------
    // IRC profiles rows 66–73 — super_admin writes, manager+ reads
    // ------------------------------------------------------------------

    @Test
    void ircProfilesAreSuperAdminWriteManagerRead() throws Exception {
        seedRoles();

        for (UserRole role : allRoles()) {
            expect(role, "POST", "/api/integrations/irc/profiles", ircProfileBody(),
                    role == UserRole.SUPER_ADMIN ? 201 : 403);
            expect(role, "GET", "/api/integrations/irc/profiles", null,
                    role == UserRole.USER ? 403 : 200);
            expect(role, "GET", "/api/integrations/irc/profiles/" + existingProfileId(),
                    null, role == UserRole.USER ? 403 : 200);

            int writeExpected = role == UserRole.SUPER_ADMIN ? 200 : 403;
            int deleteExpected = role == UserRole.SUPER_ADMIN ? 204 : 403;
            String profile = mockMvc.perform(post("/api/integrations/irc/profiles")
                            .header("Authorization", bearer(SUPER))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(ircProfileBody()))
                    .andExpect(status(201))
                    .andReturn().getResponse().getContentAsString();
            int id = mapper.readTree(profile).get("id").asInt();

            expect(role, "PUT", "/api/integrations/irc/profiles/" + id, ircProfileBody(),
                    writeExpected);
            expect(role, "POST", "/api/integrations/irc/profiles/" + id + "/activate", null,
                    writeExpected);
            expect(role, "POST", "/api/integrations/irc/profiles/" + id + "/disable", null,
                    writeExpected);
            // Stored-credential test: super_admin gate-pass only (external
            // connectivity); other roles exact 403.
            expectIrcTest(role, "/api/integrations/irc/profiles/" + id + "/test");

            String disposable = mockMvc.perform(post("/api/integrations/irc/profiles")
                            .header("Authorization", bearer(SUPER))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(ircProfileBody()))
                    .andExpect(status(201))
                    .andReturn().getResponse().getContentAsString();
            int disposableId = mapper.readTree(disposable).get("id").asInt();
            expect(role, "DELETE", "/api/integrations/irc/profiles/" + disposableId, null,
                    deleteExpected);
        }
    }

    private int existingProfileId() throws Exception {
        String list = mockMvc.perform(get("/api/integrations/irc/profiles")
                        .header("Authorization", bearer(SUPER)))
                .andExpect(status(200))
                .andReturn().getResponse().getContentAsString();
        com.fasterxml.jackson.databind.JsonNode first = mapper.readTree(list).get(0);
        if (first == null) {
            throw new IllegalStateException("No IRC profile fixture available");
        }
        return first.get("id").asInt();
    }

    // ------------------------------------------------------------------
    // Anonymous axis on the protected business surface (same filter chain
    // as the auth surface proof in AuthFlowIntegrationTest)
    // ------------------------------------------------------------------

    @Test
    void anonymousRequestIsDeniedOnTheProtectedBusinessSurface() throws Exception {
        seedRoles();
        mockMvc.perform(get("/api/conversations"))
                .andExpect(status(401));
        mockMvc.perform(post("/api/tags")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("name", "anon").toString()))
                .andExpect(status(401));
    }
}
