package com.yacc.common.contract;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.yacc.api.realtime.RealtimeEvents;
import com.yacc.api.realtime.SystemErrorDetail;
import com.yacc.api.realtime.SystemEventPayload;
import com.yacc.api.realtime.WebSocketEnvelope;
import com.yacc.api.realtime.WebSocketInboundFrame;

/**
 * MIG-041 real-time contract conformance, Java model side (AC-MIG-041-1;
 * SPEC-002 AC-02; ADR-023/ADR-026): the implemented real-time models must
 * serialize to JSON that validates against the frozen AsyncAPI JSON Schemas
 * ({@code schemas/*.schema.json}, the binding pair of
 * {@code asyncapi.yaml} per LEDGER-MIG-003-RECONCILED).
 *
 * <p>Covered here (the models MIG-050 implemented):</p>
 * <ul>
 *   <li>the outbound {@code {event,data,timestamp}} envelope
 *       (envelope.schema.json; WS-BHV-001 §4.1);</li>
 *   <li>the {@code system.*} payload model (system-payload.schema.json;
 *       WS-EVT-014/018 canonical shapes, incl. the SystemPayload error
 *       detail);</li>
 *   <li>the bare inbound demux frame data against a frozen per-channel
 *       payload schema (message-sent.schema.json; §4.6 bounded
 *       clarification);</li>
 *   <li>the frozen schema file set itself (every classpath copy parses and
 *       declares the 2020-12 dialect and an object root).</li>
 * </ul>
 *
 * <p>Per-event payload <em>emitters</em> (conversation.updated, presence,
 * typing, …) land with MIG-051 and extend this test then; transport-frame
 * conventions stay in {@code RealtimeTransportContractAlignmentTest}
 * (MIG-050).</p>
 */
@Tag("contract")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AsyncApiRealtimePayloadConformanceTest {

    /** The frozen envelope member set (schemas/envelope.schema.json). */
    private static final Set<String> ENVELOPE_MEMBERS = Set.of("event", "data", "timestamp");

    /**
     * MIG-102: the production Jackson wire posture ({@code JacksonConfig}
     * customizer via {@link ProductionJacksonPosture}) — no test-only
     * override. The envelope {@code timestamp} ({@code Instant}) serializes
     * as RFC 3339 UTC under the same posture as the REST date-time members.
     */
    private final ObjectMapper mapper = ProductionJacksonPosture.productionMapper();

    private Map<String, JsonSchema> payloadSchemas;

    @BeforeAll
    void loadPayloadSchemas() throws IOException {
        payloadSchemas = new LinkedHashMap<>();
        for (String name : List.of(
                "envelope", "conversation-updated", "message-received", "message-sent",
                "message-failed", "notification", "presence-updated", "typing-started",
                "typing-stopped", "reaction-added", "reaction-removed", "system-payload")) {
            try (InputStream schema = getClass()
                    .getResourceAsStream("/contract/schemas/" + name + ".schema.json")) {
                assertThat(schema)
                        .as("frozen %s.schema.json on the test classpath", name).isNotNull();
                JsonNode node = mapper.readTree(schema);
                assertThat(node.path("$schema").asText())
                        .as("%s.schema.json declares the frozen dialect", name)
                        .isEqualTo("https://json-schema.org/draft/2020-12/schema");
                assertThat(node.path("type").asText())
                        .as("%s.schema.json roots at an object", name).isEqualTo("object");
                // The frozen files carry a non-URI `$id` shorthand
                // (`yacc/ws/<name>.schema.json`); the validator requires an
                // absolute URI base, so it is removed in-memory only — the
                // frozen files themselves are never rewritten.
                ((ObjectNode) node).remove("$id");
                payloadSchemas.put(name, JsonSchemaFactory
                        .getInstance(SpecVersion.VersionFlag.V202012)
                        .getSchema(node, SchemaValidatorsConfig.builder()
                                .formatAssertionsEnabled(Boolean.TRUE)
                                .build()));
            }
        }
    }

    @Test
    void outboundEnvelopeModelValidatesAgainstTheFrozenEnvelopeSchema() {
        WebSocketEnvelope envelope = WebSocketEnvelope.of(
                RealtimeEvents.MESSAGE_SENT,
                mapper.createObjectNode().put("messageId", "m-1"));

        JsonNode wire = mapper.valueToTree(envelope);
        assertThat(errors("envelope", wire)).isEmpty();

        // Verbatim member set + RFC 3339 UTC timestamp at emit time
        // (WS-BHV-001). MIG-102: the emitted value is asserted, not just the
        // member's presence — the envelope {@code timestamp} is an
        // {@code Instant} and must carry the explicit UTC offset on the wire
        // (the frozen envelope schema also enforces {@code format: date-time}
        // with format assertions on above).
        assertThat(wire.fieldNames()).toIterable().containsExactlyInAnyOrderElementsOf(
                ENVELOPE_MEMBERS);
        assertThat(wire.path("event").asText()).isEqualTo("message.sent");
        assertThat(wire.path("timestamp").asText())
                .as("envelope timestamp is RFC 3339 with an explicit UTC offset")
                .matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z");
    }

    @Test
    void systemPayloadModelValidatesAgainstTheFrozenSystemPayloadSchema() {
        JsonNode connectionEstablished = mapper.valueToTree(
                SystemEventPayload.of(SystemEventPayload.TYPE_CONNECTION_ESTABLISHED));
        assertThat(errors("system-payload", connectionEstablished)).isEmpty();

        JsonNode error = mapper.valueToTree(SystemEventPayload.error(
                "internal_error", "handler failed"));
        assertThat(errors("system-payload", error)).isEmpty();
        assertThat(error.path("error").path("code").asText()).isEqualTo("internal_error");
        assertThat(new SystemErrorDetail("internal_error", "handler failed").code())
                .isEqualTo("internal_error");
    }

    @Test
    void inboundFramePayloadValidatesAgainstTheFrozenChannelPayloadSchema() {
        // §4.6: inbound client→server frames are {event, data} with a BARE
        // payload — the per-channel JSON Schema describes `data`.
        JsonNode sentData = mapper.createObjectNode()
                .put("messageId", "00000000-0000-4000-8000-000000000001")
                .put("conversationId", "00000000-0000-4000-8000-000000000002")
                .put("status", "sent")
                .put("sentAt", "2026-10-16T08:00:00.000Z");
        WebSocketInboundFrame frame = new WebSocketInboundFrame(
                RealtimeEvents.MESSAGE_SENT, sentData);

        JsonNode wire = mapper.valueToTree(frame);
        assertThat(wire.has("timestamp"))
                .as("inbound frames carry no timestamp (envelope is outbound-only)")
                .isFalse();
        assertThat(errors("message-sent", wire.path("data"))).isEmpty();
    }

    private Set<ValidationMessage> errors(String schemaName, JsonNode instance) {
        return payloadSchemas.get(schemaName).validate(instance);
    }
}
