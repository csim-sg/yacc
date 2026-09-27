package com.yacc.integration.model;

import java.util.List;

/**
 * Create/update body (frozen contract component {@code IrcProfileWrite};
 * canonicalized flat shape, password as documented additional property).
 *
 * @param name     profile name
 * @param server   IRC host
 * @param port     IRC port
 * @param nick     IRC nick/user
 * @param channels channels to join
 * @param password optional secret (write-only)
 * @param enabled  enabled flag
 */
public record ProfileWrite(String name, String server, Integer port, String nick,
        List<String> channels, String password, Boolean enabled) {
}
