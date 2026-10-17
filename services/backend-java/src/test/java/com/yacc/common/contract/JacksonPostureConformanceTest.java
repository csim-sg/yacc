package com.yacc.common.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.api.audit.AuditLogResponse;
import com.yacc.api.auth.UserResponse;
import com.yacc.api.integration.IrcConnectionStatus;
import com.yacc.api.message.MessageResponse;
import com.yacc.api.realtime.RealtimeEvents;
import com.yacc.api.realtime.WebSocketEnvelope;
import com.yacc.api.tag.CreateTagRequest;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;

/**
 * MIG-102 wire-serialization regression (AC-MIG-102-1/2/4; SPEC-002 AC-02;
 * ADR-023): pins the actual serialized wire JSON of the production Jackson
 * posture ({@link ProductionJacksonPosture}) for the two MIG-041-recorded
 * defect classes and the UTC time basis they depend on:
 *
 * <ul>
 *   <li>every {@code LocalDateTime} member emits RFC 3339 with an explicit
 *       UTC offset ({@code ...Z}), never a bare-local ISO string;</li>
 *   <li>optional non-nullable contract members are <em>omitted</em> when
 *       absent, while {@code required}+nullable members stay explicit
 *       {@code null} (no global NON_NULL — that would create a new contract
 *       violation);</li>
 *   <li>the JVM default zone is the pinned UTC basis, so the stamped offset
 *       is truthful rather than assumed (see {@code UtcTimeBasisConfig},
 *       the {@code TZ=UTC} runtime envelope and the JDBC session pin).</li>
 * </ul>
 *
 * <p>Before/after evidence (MIG-041 finding → MIG-102 fix), for a
 * {@code Asia/Singapore} build host, e.g. {@code UserResponse.createdAt}:</p>
 * <ul>
 *   <li>before: {@code "createdAt":"2026-09-27T08:00:00"},
 *       {@code "externalMessageId":null}, {@code "reconnectIncidentId":null};</li>
 *   <li>after: {@code "createdAt":"2026-09-27T08:00:00Z"},
 *       {@code externalMessageId} absent, {@code reconnectIncidentId} absent.</li>
 * </ul>
 */
@Tag("contract")
class JacksonPostureConformanceTest {

    private static final UUID UUID1 =
            UUID.fromString("00000000-0000-4000-8000-000000000001");

    private final ObjectMapper mapper = ProductionJacksonPosture.productionMapper();

    @Test
    void jvmDefaultZoneIsThePinnedUtcBasis() {
        assertThat(ZoneId.systemDefault().normalized())
                .as("the JVM default zone is the pinned UTC time basis")
                .isEqualTo(ZoneOffset.UTC);
    }

    @Test
    void localDateTimeSerializesAsRfc3339Utc() throws Exception {
        // Bare-local values gain the truthful UTC offset (AC-MIG-102-1).
        assertThat(mapper.writeValueAsString(LocalDateTime.parse("2026-10-16T08:00:00")))
                .isEqualTo("\"2026-10-16T08:00:00Z\"");
        // Sub-second precision stays (RFC 3339 fraction), offset still explicit.
        assertThat(mapper.writeValueAsString(
                LocalDateTime.parse("2026-10-16T08:00:00.123456")))
                .isEqualTo("\"2026-10-16T08:00:00.123456Z\"");
    }

    @Test
    void localDateTimeDeserializationNormalizesOffsetsToUtc() throws Exception {
        assertThat(mapper.readValue("\"2026-10-16T08:00:00Z\"", LocalDateTime.class))
                .isEqualTo(LocalDateTime.parse("2026-10-16T08:00:00"));
        // An explicit non-UTC offset is converted to the UTC basis.
        assertThat(mapper.readValue("\"2026-10-16T10:00:00+02:00\"", LocalDateTime.class))
                .isEqualTo(LocalDateTime.parse("2026-10-16T08:00:00"));
        // Bare-local wire input (the pre-MIG-102 emission) fails closed.
        assertThatExceptionOfType(DateTimeParseException.class).isThrownBy(
                () -> mapper.readValue("\"2026-10-16T08:00:00\"", LocalDateTime.class));
    }

    @Test
    void requiredNullableMembersStayExplicitNullOnTheWire() throws Exception {
        UserResponse user = new UserResponse(UUID1.toString(), "admin@example.com",
                "System Administrator", UserRole.SUPER_ADMIN.getLabel(),
                UserStatus.ACTIVE.getLabel(),
                LocalDateTime.parse("2026-09-27T08:00:00"),
                LocalDateTime.parse("2026-09-27T08:00:00"), null);

        JsonNode wire = mapper.valueToTree(user);

        // UserResponse.deletedAt is optional but nullable-typed: explicit null
        // is contract-legal and must NOT be silently dropped (no global
        // NON_NULL posture exists — MIG-102 guardrail).
        assertThat(wire.path("deletedAt").isNull())
                .as("deletedAt stays an explicit null")
                .isTrue();
        assertThat(wire.path("createdAt").asText())
                .as("date-time members carry the explicit UTC offset")
                .isEqualTo("2026-09-27T08:00:00Z");
    }

    @Test
    void optionalNonNullableMembersAreOmittedWhenAbsent() throws Exception {
        ObjectNode metadata = mapper.createObjectNode().put("platformMessageId", "tg-1");

        JsonNode message = mapper.valueToTree(new MessageResponse(UUID1, UUID1,
                UUID1.toString(), "irc-bot", "hello from IRC", "sent", "inbound",
                null, metadata,
                LocalDateTime.parse("2026-10-16T08:00:00"),
                LocalDateTime.parse("2026-10-16T08:00:00")));
        assertThat(message.has("externalMessageId"))
                .as("Message.externalMessageId (optional, non-nullable) is omitted")
                .isFalse();

        JsonNode irc = mapper.valueToTree(new IrcConnectionStatus("retrying", 2,
                LocalDateTime.parse("2026-10-16T07:00:00"), "ping timeout", null));
        assertThat(irc.has("reconnectIncidentId"))
                .as("IrcConnectionStatus.reconnectIncidentId is omitted")
                .isFalse();

        JsonNode audit = mapper.valueToTree(new AuditLogResponse(UUID1, UUID1.toString(),
                null, "conversation_status_change", "conversation", UUID1.toString(),
                metadata, null, LocalDateTime.parse("2026-10-16T08:00:00")));
        assertThat(audit.has("actorName"))
                .as("AuditLog.actorName (optional, non-nullable) is omitted")
                .isFalse();
        assertThat(audit.has("ipAddress"))
                .as("AuditLog.ipAddress (optional, non-nullable) is omitted")
                .isFalse();

        JsonNode tag = mapper.valueToTree(mapper.readValue(
                "{\"name\": \"escalation\"}", CreateTagRequest.class));
        assertThat(tag.has("color"))
                .as("CreateTagBody.color (optional, non-nullable) stays absent")
                .isFalse();
    }

    @Test
    void realtimeEnvelopeInstantStaysRfc3339Utc() throws Exception {
        WebSocketEnvelope envelope = WebSocketEnvelope.of(RealtimeEvents.MESSAGE_SENT,
                mapper.createObjectNode().put("messageId", "m-1"));

        String wire = mapper.writeValueAsString(envelope);
        assertThat(wire).contains("\"timestamp\":\"");
        assertThat(wire)
                .as("envelope timestamp is RFC 3339 with an explicit UTC offset")
                .matches(".*\"timestamp\":\"\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z\".*");
    }
}
