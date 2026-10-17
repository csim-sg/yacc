package com.yacc.common.contract;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.yacc.api.auth.AuthRefreshResponse;
import com.yacc.api.auth.AuthSessionGetResponse;
import com.yacc.api.auth.AuthSessionResponse;
import com.yacc.api.auth.AuthSignOutResponse;
import com.yacc.api.user.CreateUserRequest;
import com.yacc.api.auth.ForgotPasswordRequest;
import com.yacc.api.auth.MessageResponse;
import com.yacc.api.auth.ResetPasswordRequest;
import com.yacc.api.auth.SuccessMessageResponse;
import com.yacc.api.user.UpdateUserRequest;
import com.yacc.api.auth.UserResponse;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.api.auth.VerifyEmailRequest;
import com.yacc.common.model.BaseListResponse;
import com.yacc.common.model.ErrorResponse;
import com.yacc.common.model.IntegrationErrorResponse;
import com.yacc.api.conversation.AssignRequest;
import com.yacc.api.conversation.AssignmentResponse;
import com.yacc.api.conversation.BulkActionRequest;
import com.yacc.api.conversation.BulkActionResponseData;
import com.yacc.api.dlq.DlqEntryResponse;
import com.yacc.api.integration.IrcConfigRequest;
import com.yacc.api.integration.IrcConnectionStatus;
import com.yacc.api.integration.Profile;
import com.yacc.api.integration.ProfileResponse;
import com.yacc.api.integration.ProfileWrite;
import com.yacc.api.message.MessageListResponse;
import com.yacc.api.message.SendMessageBody;
import com.yacc.api.note.CreateNoteRequest;
import com.yacc.api.note.NoteResponse;
import com.yacc.api.notification.NotificationResponse;
import com.yacc.api.routingrule.RoutingRuleResponse;
import com.yacc.api.tag.CreateTagRequest;
import com.yacc.api.tag.TagResponse;
import com.yacc.api.user.CreateUserResponse;
import com.yacc.api.user.DeleteUserResponse;
import com.yacc.api.user.UpdateUserResponse;

/**
 * MIG-041 payload-level contract conformance, Java DTO side (AC-MIG-041-1;
 * SPEC-002 AC-02; ADR-023 contract-first): every DTO mapped to a frozen
 * {@code openapi.yaml} (v1.0.0-mig-003-canonical) component must serialize
 * to — and deserialize from — JSON that validates against that component
 * schema (JSON Schema 2020-12 dialect, format assertions on).
 *
 * <p>Two directions per case:</p>
 * <ul>
 *   <li><strong>response components</strong> — a representative DTO instance
 *       is serialized with the production Jackson posture (the app-wide
 *       {@code JacksonConfig} customizer: RFC 3339 UTC date-time, narrow
 *       per-member {@code NON_NULL} omission — MIG-102) and the wire JSON is
 *       validated, strictly and without exclusions;</li>
 *   <li><strong>request components</strong> — a wire fixture is first
 *       validated as contract-legal, then deserialized into the request DTO
 *       (wire → DTO), then the DTO is re-serialized and re-validated
 *       (DTO → wire).</li>
 * </ul>
 *
 * <p>Deliberately NOT mapped here (each for a recorded reason):</p>
 * <ul>
 *   <li>{@code Health*Response} — Actuator-owned map payloads (ADR-029), no
 *       Java DTO by design; wire-tested by the MIG-010/MIG-012 observability
 *       tests;</li>
 *   <li>{@code Conversation} — conversations surface has no dedicated Java
 *       response DTO (MIG-040 serves it from persistence models and its
 *       integration tests hold the evidence);</li>
 *   <li>{@code RoutingRuleWrite} — ADR-021 lenient JSON body, carried as
 *       {@code JsonNode} at the boundary (ARCH-004 §3);</li>
 *   <li>{@code UserRole}/{@code UserStatus} — covered as enum-membership
 *       cases, not object schemas.</li>
 * </ul>
 *
 * <p>Route-level coverage is {@link RestRouteCoverageConformanceTest}
 * (MIG-040); real-time payload conformance is
 * {@code AsyncApiRealtimePayloadConformanceTest}.</p>
 */
@Tag("contract")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OpenApiDtoConformanceTest {

    private static final String FROZEN_VERSION = "1.0.0-mig-003-canonical";

    private static final UUID UUID1 =
            UUID.fromString("00000000-0000-4000-8000-000000000001");

    /**
     * MIG-102: the production Jackson wire posture — the same
     * {@link com.yacc.config.JacksonConfig} customizer the Spring context
     * applies to the auto-configured mapper (MVC converters + WebSocket
     * publisher). Built via {@link ProductionJacksonPosture}; there is no
     * test-only inclusion or format override anywhere. {@link LocalDateTime}
     * members serialize as RFC 3339 UTC ({@code ...Z}); optional non-nullable
     * members omit via narrow per-member {@code @JsonInclude(NON_NULL)}
     * annotations on the affected records (MIG-102), while required+nullable
     * members keep explicit {@code null}.
     */
    private final ObjectMapper mapper = ProductionJacksonPosture.productionMapper();

    private JsonNode components;

    private final Map<String, JsonSchema> schemaCache = new HashMap<>();

    /** Frozen contract component → representative DTO instance. */
    private final List<ResponseCase> responseCases = new ArrayList<>();

    /** Frozen contract component → wire fixture + request DTO type. */
    private final List<RequestCase> requestCases = new ArrayList<>();

    private record ResponseCase(String component, String dto, Supplier<Object> instance) {
    }

    private record RequestCase(String component, String fixtureJson, Class<?> dtoType) {
    }

    @BeforeAll
    void loadContractAndCases() throws IOException {
        try (InputStream contract = getClass().getResourceAsStream("/contract/openapi.yaml")) {
            assertThat(contract).as("frozen openapi.yaml on the test classpath").isNotNull();
            JsonNode root = new ObjectMapper(new YAMLFactory()).readTree(contract);
            assertThat(root.path("info").path("version").asText())
                    .as("classpath contract stays the frozen canonical revision")
                    .isEqualTo(FROZEN_VERSION);
            components = root.path("components").path("schemas");
        }

        UserResponse wireUser = new UserResponse(
                UUID1.toString(), "admin@example.com", "System Administrator",
                UserRole.SUPER_ADMIN.getLabel(), UserStatus.ACTIVE.getLabel(),
                LocalDateTime.parse("2026-09-27T08:00:00"),
                LocalDateTime.parse("2026-09-27T08:00:00"), null);

        // ---------- Response components (component name = frozen name) ----------
        responseCases.add(new ResponseCase("ErrorResponse", "ErrorResponse",
                () -> new ErrorResponse("invalid request")));
        responseCases.add(new ResponseCase("IntegrationErrorResponse", "IntegrationErrorResponse",
                () -> new IntegrationErrorResponse("validation_error", "port must be an integer")));
        responseCases.add(new ResponseCase("MessageResponse", "auth MessageResponse",
                () -> new MessageResponse("password reset email sent")));
        responseCases.add(new ResponseCase("SuccessMessageResponse", "SuccessMessageResponse",
                () -> new SuccessMessageResponse(true, "password reset successful")));
        responseCases.add(new ResponseCase("AuthSessionResponse", "AuthSessionResponse",
                () -> new AuthSessionResponse(wireUser, "access-jwt", "refresh-grant", true)));
        responseCases.add(new ResponseCase("AuthSignOutResponse", "AuthSignOutResponse",
                () -> new AuthSignOutResponse(true)));
        responseCases.add(new ResponseCase("AuthSessionGetResponse", "AuthSessionGetResponse",
                () -> new AuthSessionGetResponse(wireUser, true)));
        responseCases.add(new ResponseCase("AuthRefreshResponse", "AuthRefreshResponse",
                () -> new AuthRefreshResponse("rotated-access", "rotated-refresh")));
        responseCases.add(new ResponseCase("UserResponse", "UserResponse", () -> wireUser));
        responseCases.add(new ResponseCase("CreateUserResponse", "CreateUserResponse",
                () -> new CreateUserResponse(UUID1.toString(), "admin@example.com",
                        "System Administrator", "super_admin", "active",
                        LocalDateTime.parse("2026-09-27T08:00:00"))));
        responseCases.add(new ResponseCase("UpdateUserResponse", "UpdateUserResponse",
                () -> new UpdateUserResponse(UUID1.toString(), "admin@example.com",
                        "System Administrator", "super_admin", "active")));
        responseCases.add(new ResponseCase("DeleteUserResponse", "DeleteUserResponse",
                () -> new DeleteUserResponse(UUID1.toString(),
                        LocalDateTime.parse("2026-10-16T08:00:00"))));
        responseCases.add(new ResponseCase("BaseListResponse", "BaseListResponse<UserResponse>",
                () -> BaseListResponse.of(List.of(wireUser), 1, 20, 1)));
        responseCases.add(new ResponseCase("AssignmentResponse", "AssignmentResponse",
                () -> new AssignmentResponse("assignment-1", UUID1.toString(),
                        UUID1.toString(), UUID1.toString(), "2026-10-16T08:00:00")));
        responseCases.add(new ResponseCase("BulkActionResponseData", "BulkActionResponseData",
                () -> new BulkActionResponseData(1, 0, List.of())));
        responseCases.add(new ResponseCase("Message", "message MessageResponse",
                () -> sampleMessage()));
        responseCases.add(new ResponseCase("MessageListResponse", "MessageListResponse",
                () -> new MessageListResponse(List.of(sampleMessage()), 1, 1, 50)));
        responseCases.add(new ResponseCase("Note", "NoteResponse",
                () -> new NoteResponse(UUID1, UUID1, UUID1.toString(), "internal note",
                        List.of(), LocalDateTime.parse("2026-10-16T08:00:00"),
                        LocalDateTime.parse("2026-10-16T08:00:00"))));
        responseCases.add(new ResponseCase("Tag", "TagResponse",
                () -> new TagResponse(1, "escalation", "#FF5A5F", UUID1.toString(),
                        LocalDateTime.parse("2026-10-16T08:00:00"))));
        responseCases.add(new ResponseCase("RoutingRule", "RoutingRuleResponse",
                () -> new RoutingRuleResponse(UUID1, "route telegram", "keyword route",
                        "active", 10, staticJson("{\"keyword\": \"urgent\"}"),
                        staticJson("{\"assign\": 2}"), UUID1.toString(), null,
                        LocalDateTime.parse("2026-10-16T08:00:00"),
                        LocalDateTime.parse("2026-10-16T08:00:00"))));
        responseCases.add(new ResponseCase("Notification", "NotificationResponse",
                () -> new NotificationResponse(UUID1, UUID1.toString(), "assignment", UUID1,
                        UUID1.toString(), "conversation assigned", false, null,
                        LocalDateTime.parse("2026-10-16T08:00:00"))));
        responseCases.add(new ResponseCase("AuditLog", "AuditLogResponse",
                () -> new com.yacc.api.audit.AuditLogResponse(UUID1, UUID1.toString(),
                        "System Administrator", "conversation_status_change", "conversation",
                        UUID1.toString(), staticJson("{\"from\": \"open\"}"), "127.0.0.1",
                        LocalDateTime.parse("2026-10-16T08:00:00"))));
        responseCases.add(new ResponseCase("DlqEntry", "DlqEntryResponse",
                () -> new DlqEntryResponse(UUID1, UUID1, UUID1, "delivery_timeout", 3,
                        "connection refused", LocalDateTime.parse("2026-10-16T08:00:00"),
                        LocalDateTime.parse("2026-10-16T09:00:00"), null, null, null)));
        responseCases.add(new ResponseCase("IrcConnectionStatus", "IrcConnectionStatus",
                () -> new IrcConnectionStatus("retrying", 2,
                        LocalDateTime.parse("2026-10-16T07:00:00"), "ping timeout", null)));
        responseCases.add(new ResponseCase("IrcProfile", "ProfileResponse",
                () -> new ProfileResponse(1, "primary", true, true,
                        new Profile("irc.libera.chat", 6697, "yacc-bot", List.of("#yacc")),
                        true, LocalDateTime.parse("2026-10-16T08:00:00"), Boolean.TRUE,
                        LocalDateTime.parse("2026-10-16T08:00:00"),
                        LocalDateTime.parse("2026-10-16T08:00:00"))));

        // ---------- Request components (fixture → DTO → fixture') ----------
        requestCases.add(new RequestCase("ForgotPasswordBody",
                "{\"email\": \"admin@example.com\"}", ForgotPasswordRequest.class));
        requestCases.add(new RequestCase("ResetPasswordBody",
                "{\"token\": \"" + "a".repeat(64) + "\", \"password\": \"new-secret-1\"}",
                ResetPasswordRequest.class));
        requestCases.add(new RequestCase("VerifyEmailBody",
                "{\"token\": \"" + "b".repeat(64) + "\"}", VerifyEmailRequest.class));
        requestCases.add(new RequestCase("CreateUserBody",
                "{\"email\": \"new.user@example.com\", \"password\": \"secret-password\", "
                        + "\"name\": \"New User\", \"role\": \"user\"}",
                CreateUserRequest.class));
        requestCases.add(new RequestCase("UpdateUserBody",
                "{\"name\": \"Renamed User\", \"role\": \"manager\"}", UpdateUserRequest.class));
        requestCases.add(new RequestCase("SendMessageBody",
                "{\"body\": \"hello there\", \"attachmentIds\": [\"" + UUID1 + "\"]}",
                SendMessageBody.class));
        requestCases.add(new RequestCase("CreateNoteBody",
                "{\"body\": \"internal note\", \"replyToMessageId\": \"" + UUID1 + "\", "
                        + "\"isInternal\": true}", CreateNoteRequest.class));
        requestCases.add(new RequestCase("CreateTagBody",
                "{\"name\": \"escalation\", \"color\": \"#FF5A5F\"}", CreateTagRequest.class));
        requestCases.add(new RequestCase("AssignBody",
                "{\"assignedUserId\": \"" + UUID1 + "\"}", AssignRequest.class));
        requestCases.add(new RequestCase("BulkActionRequest",
                "{\"conversationIds\": [\"" + UUID1 + "\"], \"action\": \"assign\", "
                        + "\"data\": {\"assigneeId\": \"" + UUID1 + "\"}}",
                BulkActionRequest.class));
        requestCases.add(new RequestCase("IrcConfigBody",
                "{\"server\": \"irc.libera.chat\", \"port\": 6697, \"username\": \"yacc-bot\", "
                        + "\"channels\": [\"#yacc\", \"#ops\"]}",
                IrcConfigRequest.class));
        requestCases.add(new RequestCase("IrcProfileWrite",
                "{\"name\": \"primary\", \"server\": \"irc.libera.chat\", \"port\": 6697, "
                        + "\"nick\": \"yacc-bot\", \"channels\": [\"#yacc\"]}",
                ProfileWrite.class));
    }

    /** Representative wire message reused by the Message + MessageListResponse cases. */
    private com.yacc.api.message.MessageResponse sampleMessage() {
        // senderId and metadata are required-nullable members: present on the
        // wire, so the representative instance carries non-null values.
        return new com.yacc.api.message.MessageResponse(UUID1, UUID1, UUID1.toString(),
                "irc-bot", "hello from IRC", "sent", "inbound", "ext-msg-1",
                staticJson("{\"platformMessageId\": \"tg-1\"}"),
                LocalDateTime.parse("2026-10-16T08:00:00"),
                LocalDateTime.parse("2026-10-16T08:00:00"));
    }

    private JsonNode staticJson(String json) {
        try {
            return mapper.readTree(json);
        } catch (IOException e) {
            throw new IllegalStateException("bad test fixture JSON", e);
        }
    }

    @Test
    void everyMappedComponentExistsInTheFrozenContract() {
        Set<String> mapped = new java.util.HashSet<>();
        responseCases.forEach(entry -> mapped.add(entry.component()));
        requestCases.forEach(entry -> mapped.add(entry.component()));

        Set<String> frozen = new java.util.HashSet<>();
        components.fieldNames().forEachRemaining(frozen::add);

        assertThat(mapped)
                .as("mapped component names must exist in openapi.yaml components")
                .allMatch(frozen::contains);
    }

    @Test
    void responseDtosSerializeToContractConformingJson() {
        Map<String, Set<ValidationMessage>> failures = new LinkedHashMap<>();
        responseCases.forEach(entry -> {
            JsonNode wire = mapper.valueToTree(entry.instance().get());
            Set<ValidationMessage> errors = validate(entry.component(), wire);
            if (!errors.isEmpty()) {
                failures.put(entry.component() + " ← " + entry.dto() + ": " + wire, errors);
            }
        });
        assertThat(failures).as("DTO → wire conformance failures").isEmpty();
    }

    @Test
    void requestDtosRoundTripContractConformingWireJson() {
        Map<String, Set<ValidationMessage>> failures = new LinkedHashMap<>();
        requestCases.forEach(entry -> {
            try {
                JsonNode fixture = mapper.readTree(entry.fixtureJson());
                Set<ValidationMessage> fixtureErrors = validate(
                        entry.component(), fixture);
                if (!fixtureErrors.isEmpty()) {
                    failures.put(
                            entry.component() + " fixture ← " + entry.fixtureJson(), fixtureErrors);
                    return;
                }
                Object dto = mapper.readValue(entry.fixtureJson(), entry.dtoType());
                JsonNode reEmitted = mapper.valueToTree(dto);
                Set<ValidationMessage> roundTripErrors = validate(
                        entry.component(), reEmitted);
                if (!roundTripErrors.isEmpty()) {
                    failures.put(entry.component() + " re-emitted ← " + reEmitted,
                            roundTripErrors);
                }
            } catch (IOException e) {
                failures.put(entry.component() + " deserialization",
                        Set.of(new ValidationMessage.Builder()
                                .type("deserialization").message(String.valueOf(e)).build()));
            }
        });
        assertThat(failures).as("wire → DTO → wire conformance failures").isEmpty();
    }

    @Test
    void wireEnumLabelsMatchTheFrozenUserRoleAndUserStatusEnums() {
        assertThat(enumLabels("UserRole"))
                .containsExactlyInAnyOrder("super_admin", "admin", "manager", "user");
        assertThat(java.util.Arrays.stream(UserRole.values())
                .map(UserRole::getLabel).collect(Collectors.toSet()))
                .isEqualTo(enumLabels("UserRole"));

        assertThat(enumLabels("UserStatus"))
                .containsExactlyInAnyOrder("active", "inactive", "suspended");
        assertThat(java.util.Arrays.stream(UserStatus.values())
                .map(UserStatus::getLabel).collect(Collectors.toSet()))
                .isEqualTo(enumLabels("UserStatus"));
    }

    private Set<String> enumLabels(String component) {
        JsonNode values = components.path(component).path("enum");
        Set<String> labels = new java.util.HashSet<>();
        values.forEach(v -> labels.add(v.asText()));
        return labels;
    }

    /** Validates {@code instance} against the named component of the frozen contract. */
    private Set<ValidationMessage> validate(String component, JsonNode instance) {
        return schemaFor(component).validate(instance);
    }

    /**
     * Builds (and caches) a JSON Schema 2020-12 validator for one component.
     * The component is validated through a wrapper document that also carries
     * every frozen component, so internal {@code $ref} pointers
     * ({@code #/components/schemas/…}) resolve exactly as authored.
     */
    private JsonSchema schemaFor(String component) {
        return schemaCache.computeIfAbsent(component, name -> {
            ObjectNode root = mapper.createObjectNode();
            root.put("$schema", "https://json-schema.org/draft/2020-12/schema");
            ObjectNode componentsWrapper = mapper.createObjectNode();
            componentsWrapper.set("schemas", components);
            root.set("components", componentsWrapper);
            ArrayNode allOf = root.putArray("allOf");
            allOf.addObject().put("$ref", "#/components/schemas/" + name);
            SchemaValidatorsConfig config = SchemaValidatorsConfig.builder()
                    .formatAssertionsEnabled(Boolean.TRUE)
                    .build();
            return JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012)
                    .getSchema(root, config);
        });
    }
}
