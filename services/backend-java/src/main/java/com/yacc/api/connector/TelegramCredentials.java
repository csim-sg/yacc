package com.yacc.api.connector;

import java.util.regex.Pattern;

/**
 * Resolved Telegram credentials (POC {@code TelegramAdapterConfig} parity:
 * {@code botToken} + optional {@code botName}). The token lives only in
 * memory for the connection lifetime — never logged, never returned.
 */
public record TelegramCredentials(String botToken, String botName) {

    /**
     * Baseline token-format parity ({@code isValidTelegramToken}):
     * {@code <9-10 digits>:<35 token chars>}.
     */
    private static final Pattern TOKEN_FORMAT = Pattern.compile("^\\d{9,10}:[A-Za-z0-9_-]{35}$");

    /**
     * Baseline bot-token format validation (digits:35-char-alphabet).
     *
     * @param token candidate token
     * @return {@code true} when the token matches the Telegram bot format
     */
    public static boolean isValidTokenFormat(String token) {
        return token != null && TOKEN_FORMAT.matcher(token).matches();
    }
}
