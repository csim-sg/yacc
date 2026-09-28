package com.yacc.audit.model;

/**
 * Export outcome.
 *
 * @param data   file body
 * @param format csv | json
 */
public record Export(String data, String format) {

    /** Suggested download filename (frozen contract parity). */
    public String filename() {
        return "audit-logs-" + java.time.Instant.now() + "." + format();
    }
}
