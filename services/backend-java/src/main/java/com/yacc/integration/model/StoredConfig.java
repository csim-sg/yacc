package com.yacc.integration.model;

import java.util.List;

/**
 * Stored configuration (credential decrypted for the connector only).
 *
 * @param server   IRC host
 * @param port     IRC port
 * @param username IRC nick/user
 * @param password decrypted password or null
 * @param channels configured channels
 * @param source   db | env | body
 */
public record StoredConfig(String server, int port, String username, String password,
        List<String> channels, String source) {
}
