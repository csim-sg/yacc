package com.yacc.api.connector;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * One parsed inbound IRC protocol line (RFC 1459 §2.3.1 subset the
 * connector needs: optional prefix, command, middle params, trailing).
 * Parsing is deliberately minimal — the pinned no-dependency client only
 * has to register, join, relay PRIVMSG/NOTICE and answer PING.
 *
 * @param raw     the untouched line (parity {@code rawPayload})
 * @param prefix  prefix without the leading colon (nick!user@host or
 *                server name), null when the line carries no prefix
 * @param command command/numeric, upper-cased (e.g. {@code PRIVMSG},
 *                {@code 001})
 * @param params  middle parameters (no trailing)
 * @param trailing text after the first {@code " :"} separator, null when
 *                the line carries no trailing part
 */
public record IrcLine(String raw, String prefix, String command, List<String> params,
        String trailing) {

    /**
     * Parses one raw protocol line (CR/LF tolerated).
     *
     * @param raw raw line as read from the socket
     * @return parsed line (never null; blank lines parse to an empty
     *         command so callers can skip them)
     */
    public static IrcLine parse(String raw) {
        String line = raw;
        if (line.endsWith("\n")) {
            line = line.substring(0, line.length() - 1);
        }
        if (line.endsWith("\r")) {
            line = line.substring(0, line.length() - 1);
        }
        String prefix = null;
        if (line.startsWith(":")) {
            int separator = line.indexOf(' ');
            if (separator < 0) {
                return new IrcLine(raw, line.substring(1), "", List.of(), null);
            }
            prefix = line.substring(1, separator);
            line = line.substring(separator + 1);
        }
        String trailing = null;
        int trailingStart = line.indexOf(" :");
        if (trailingStart >= 0) {
            trailing = line.substring(trailingStart + 2);
            line = line.substring(0, trailingStart);
        }
        String[] tokens = line.isEmpty() ? new String[0] : line.split(" +");
        String command = tokens.length > 0 ? tokens[0].toUpperCase(Locale.ROOT) : "";
        List<String> params = new ArrayList<>();
        for (int i = 1; i < tokens.length; i++) {
            params.add(tokens[i]);
        }
        return new IrcLine(raw, prefix, command, List.copyOf(params), trailing);
    }

    /** First middle parameter (e.g. the PRIVMSG target); null when absent. */
    public String firstParam() {
        return params.isEmpty() ? null : params.get(0);
    }

    /**
     * Sender nick from a {@code nick!user@host} prefix (the whole prefix
     * when it carries no {@code !}); null for prefix-less lines.
     */
    public String nick() {
        if (prefix == null) {
            return null;
        }
        int bang = prefix.indexOf('!');
        return bang < 0 ? prefix : prefix.substring(0, bang);
    }
}
