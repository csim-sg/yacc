package com.yacc.api.connector;

import java.util.List;

/**
 * Resolved IRC connection runtime config (POC {@code ResolvedIrcConfig}
 * parity) — DB-first resolution output, consumed by
 * {@link IrcConnector#connect()}. The decrypted password exists only in
 * memory for the connection lifetime — never logged, never returned.
 *
 * @param server    IRC server host
 * @param port      IRC server port (profile parity default 6667)
 * @param nick      IRC nick (stored {@code username})
 * @param password  optional server password (PASS), null when unconfigured
 * @param channels  channels joined after registration
 * @param profileId numeric id of the IRC profile the config resolved from,
 *                  null when resolved from the single-config store
 */
public record IrcConnectionConfig(String server, int port, String nick, String password,
        List<String> channels, Integer profileId) {

    /** Channels are joined after registration (baseline handshake order). */
    public IrcConnectionConfig {
        channels = channels == null ? List.of() : List.copyOf(channels);
    }
}
