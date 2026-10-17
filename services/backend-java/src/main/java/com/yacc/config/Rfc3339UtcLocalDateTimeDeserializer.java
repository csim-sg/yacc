package com.yacc.config;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;

/**
 * MIG-102: the counterpart of {@link Rfc3339UtcLocalDateTimeSerializer} —
 * parses RFC 3339 date-time wire values (offset required, {@code Z} or
 * {@code ±HH:MM}) into {@link LocalDateTime} normalized to the pinned UTC
 * basis. Malformed or offset-less input fails closed (parse exception → 400),
 * never a silent value shift. Registered app-wide by {@link JacksonConfig}.
 */
public class Rfc3339UtcLocalDateTimeDeserializer extends JsonDeserializer<LocalDateTime> {

    @Override
    public LocalDateTime deserialize(JsonParser parser,
            DeserializationContext ctxt) throws IOException {
        return OffsetDateTime.parse(parser.getValueAsString().trim())
                .atZoneSameInstant(ZoneOffset.UTC)
                .toLocalDateTime();
    }
}
