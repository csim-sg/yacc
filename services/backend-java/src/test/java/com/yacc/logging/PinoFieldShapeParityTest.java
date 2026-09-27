package com.yacc.logging;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.slf4j.event.KeyValuePair;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.yacc.common.logging.PinoJsonEncoder;

/**
 * Field-shape parity contract for the production JSON log format (SPEC-002
 * TR-07; ADR-029): {@code {"level","time","msg","correlationId",...}} matching
 * the POC's pino output, one JSON object per line. Events are captured through
 * the real logback runtime (ListAppender) so the encoder sees production-shaped
 * events.
 */
class PinoFieldShapeParityTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final PinoJsonEncoder encoder = new PinoJsonEncoder();
    private final Logger logger = (Logger) LoggerFactory.getLogger(PinoFieldShapeParityTest.class);
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();

    @BeforeEach
    void attachAppender() {
        appender.start();
        logger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        logger.detachAppender(appender);
        MDC.clear();
    }

    private ILoggingEvent capturedEvent() {
        assertThat(appender.list).hasSize(1);
        return appender.list.get(0);
    }

    @Test
    void emitsPinoFieldShape() throws Exception {
        MDC.put("correlationId", "corr-42");
        logger.info("hello parity");

        JsonNode json = mapper.readTree(encoder.encode(capturedEvent()));

        assertThat(json.get("level").asText()).isEqualTo("info");
        assertThat(json.get("time").asText()).matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z");
        assertThat(json.get("msg").asText()).isEqualTo("hello parity");
        assertThat(json.get("correlationId").asText()).isEqualTo("corr-42");
    }

    @Test
    void keyValuePairsKeepTheirValueTypes() throws Exception {
        logger.atInfo().addKeyValue("audit", true).log("audit AuthenticationSuccessEvent");

        JsonNode json = mapper.readTree(encoder.encode(capturedEvent()));

        assertThat(json.get("audit").isBoolean()).isTrue();
        assertThat(json.get("audit").asBoolean()).isTrue();
    }

    @Test
    void failureEventsCarryPinoStyleErrObject() throws Exception {
        logger.atError().setCause(new IllegalStateException("boom")).log("failed");

        JsonNode json = mapper.readTree(encoder.encode(capturedEvent()));

        assertThat(json.get("level").asText()).isEqualTo("error");
        assertThat(json.get("err").get("type").asText()).isEqualTo("java.lang.IllegalStateException");
        assertThat(json.get("err").get("message").asText()).isEqualTo("boom");
        assertThat(json.get("err").get("stack").asText()).contains("PinoFieldShapeParityTest");
    }

    @Test
    void outputIsNewlineDelimited() {
        logger.info("line check");

        byte[] encoded = encoder.encode(capturedEvent());

        assertThat(encoded[encoded.length - 1]).isEqualTo((byte) '\n');
        assertThat(new String(encoded, StandardCharsets.UTF_8)).hasLineCount(1);
    }
}
