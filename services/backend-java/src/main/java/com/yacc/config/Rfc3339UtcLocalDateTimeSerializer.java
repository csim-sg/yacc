package com.yacc.config;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;

/**
 * MIG-102 (AC-MIG-102-1; ADR-023): serializes {@link LocalDateTime} as RFC
 * 3339 with an explicit UTC offset — {@code 2026-10-16T08:00:00Z} — matching
 * the frozen contract's {@code format: date-time} members and the captured JS
 * baseline ({@code new Date().toISOString()}).
 *
 * <p>The offset is truthful, not cosmetic: {@code LocalDateTime} values are
 * UTC wall-clock by the pinned time basis (see {@link UtcTimeBasisConfig};
 * the JVM default zone is UTC and ADR-027 {@code timestamp} (without zone)
 * columns are bound literally, never converted in transit). Stateless and
 * thread-safe ({@link DateTimeFormatter} is immutable); registered app-wide
 * by {@link JacksonConfig}, never per-endpoint.</p>
 */
public class Rfc3339UtcLocalDateTimeSerializer extends JsonSerializer<LocalDateTime> {

    /** RFC 3339 with offset; the UTC offset renders as {@code Z}. */
    private static final DateTimeFormatter RFC3339_UTC = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    @Override
    public void serialize(LocalDateTime value, JsonGenerator gen,
            SerializerProvider serializers) throws IOException {
        gen.writeString(value.atOffset(ZoneOffset.UTC).format(RFC3339_UTC));
    }
}
