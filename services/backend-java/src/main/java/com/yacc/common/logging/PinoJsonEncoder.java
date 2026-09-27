package com.yacc.common.logging;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.slf4j.event.KeyValuePair;

import com.fasterxml.jackson.core.JsonEncoding;
import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonGenerator;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.encoder.EncoderBase;

/**
 * Logback encoder emitting exactly the POC pino JSON field shape on one line
 * (SPEC-002 TR-07; ADR-029 "field-shape parity with pino"; ledger REST-XSRV-004).
 *
 * <p>Output per event: {@code level} (lowercase label, pino formatters.level),
 * {@code time} (ISO-8601 UTC milliseconds, pino isoTime), {@code msg}, the MDC
 * entries (e.g. {@code correlationId}) at the top level, SLF4J key-value pairs
 * (e.g. the audit {@code audit:true} flag, keeping their value types), and on
 * failure a pino-style {@code err} object ({@code type}/{@code message}/
 * {@code stack}).</p>
 *
 * <p>A dedicated encoder — rather than a generic logstash-style one — is what
 * makes the parity exact without post-processing configuration.</p>
 */
public class PinoJsonEncoder extends EncoderBase<ILoggingEvent> {

    private static final DateTimeFormatter ISO_MILLIS_UTC =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private static final JsonFactory JSON_FACTORY = new JsonFactory();

    @Override
    public byte[] headerBytes() {
        return null;
    }

    @Override
    public byte[] footerBytes() {
        return null;
    }

    @Override
    public byte[] encode(ILoggingEvent event) {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream(512);
        try (JsonGenerator generator = JSON_FACTORY.createGenerator(buffer, JsonEncoding.UTF8)) {
            generator.writeStartObject();
            generator.writeStringField("level", event.getLevel().toString().toLowerCase(Locale.ROOT));
            generator.writeStringField("time", ISO_MILLIS_UTC.format(Instant.ofEpochMilli(event.getTimeStamp())));
            generator.writeStringField("msg", event.getFormattedMessage());
            for (Map.Entry<String, String> mdcEntry : event.getMDCPropertyMap().entrySet()) {
                generator.writeStringField(mdcEntry.getKey(), mdcEntry.getValue());
            }
            List<KeyValuePair> pairs = event.getKeyValuePairs();
            if (pairs != null) {
                for (KeyValuePair pair : pairs) {
                    generator.writeObjectField(pair.key, pair.value);
                }
            }
            writeThrowable(generator, event.getThrowableProxy());
            generator.writeEndObject();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to encode log event as JSON", e);
        }
        buffer.write('\n');
        return buffer.toByteArray();
    }

    /** Pino {@code err} serializer shape: {@code {type, message, stack}}. */
    private void writeThrowable(JsonGenerator generator, IThrowableProxy throwable) throws IOException {
        if (throwable == null) {
            return;
        }
        generator.writeObjectFieldStart("err");
        generator.writeStringField("type", throwable.getClassName());
        generator.writeStringField("message", throwable.getMessage());
        generator.writeStringField("stack", ThrowableProxyUtil.asString(throwable));
        generator.writeEndObject();
    }
}
