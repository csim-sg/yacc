package com.yacc.integration.model;

import java.util.List;

/**
 * Non-secret profile config (POC {@code IrcProfileConfig} parity).
 *
 * @param server   IRC host
 * @param port     IRC port
 * @param username IRC nick/user
 * @param channels configured channels
 */
public record Profile(String server, Integer port, String username, List<String> channels) {
}
