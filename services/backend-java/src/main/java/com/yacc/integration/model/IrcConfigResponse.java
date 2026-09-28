package com.yacc.integration.model;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Sanitized saved-config view (frozen contract op {@code saveIrcConfig}
 * 200 payload): never carries the password, only {@code hasPassword}.
 *
 * @param server IRC server host
 * @param port IRC server port
 * @param username IRC nick/user
 * @param channels configured channels
 * @param hasPassword true when a credential is stored
 * @param updatedAt last update timestamp
 */
public record IrcConfigResponse(
        String server,
        int port,
        String username,
        List<String> channels,
        boolean hasPassword,
        LocalDateTime updatedAt) {
}
