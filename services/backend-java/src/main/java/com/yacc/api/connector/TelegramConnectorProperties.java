package com.yacc.api.connector;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Telegram connector env-bound policy (ARCH-004 §4; MIG-060). Credentials
 * are deliberately NOT properties — the bot token resolves DB-first through
 * {@link TelegramCredentialsResolver} (encrypted at rest, ADR-027).
 *
 * @param baseUrl Bot API base URL (default {@code https://api.telegram.org}).
 *                Env {@code YACC_CONNECTOR_TELEGRAM_BASE_URL}.
 */
@ConfigurationProperties(prefix = "yacc.connector.telegram")
public record TelegramConnectorProperties(String baseUrl) {

    /** Baseline Bot API origin parity. */
    public static final String DEFAULT_BASE_URL = "https://api.telegram.org";

    public TelegramConnectorProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = DEFAULT_BASE_URL;
        }
    }
}
