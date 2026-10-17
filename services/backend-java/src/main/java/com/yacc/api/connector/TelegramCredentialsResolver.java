package com.yacc.api.connector;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.entity.IntegrationConnectionProfile;
import com.yacc.repository.IntegrationConnectionProfileRepository;
import com.yacc.service.EncryptionService;

/**
 * DB-first Telegram credential resolution (guardrail: DB-first, no
 * plaintext). The bot token lives in an {@link IntegrationConnectionProfile}
 * ({@code integration_type = 'telegram'}) whose {@code encrypted_credentials}
 * JSON ({@code {"botToken": ...}}) is AES-256-GCM ciphertext (ADR-027) —
 * decrypted with the existing {@link EncryptionService#decrypt(String)} and
 * validated against the baseline token format. The optional non-secret
 * {@code botName} comes from the profile's {@code config} JSON. No env
 * fallback exists (fail-closed: no credentials → empty).
 */
@Service
public class TelegramCredentialsResolver {

    private static final Logger log = LoggerFactory.getLogger(TelegramCredentialsResolver.class);

    /** Profile {@code integration_type} discriminator for this connector. */
    private static final String INTEGRATION_TYPE = "telegram";

    private final IntegrationConnectionProfileRepository profiles;
    private final EncryptionService encryption;
    private final ObjectMapper mapper;

    public TelegramCredentialsResolver(IntegrationConnectionProfileRepository profiles,
            EncryptionService encryption, ObjectMapper mapper) {
        this.profiles = profiles;
        this.encryption = encryption;
        this.mapper = mapper;
    }

    /**
     * Resolves the connector credentials: the active telegram profile wins,
     * else the first enabled one (baseline single-connection posture).
     * Returns empty when no eligible profile exists, the ciphertext fails
     * authentication, or the stored token is missing/malformed — the
     * connector then refuses to connect (fail-closed). The token never
     * reaches logs.
     */
    @Transactional(readOnly = true)
    public Optional<TelegramCredentials> resolve() {
        List<IntegrationConnectionProfile> candidates = profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, INTEGRATION_TYPE);
        return candidates.stream()
                .filter(IntegrationConnectionProfile::isActive)
                .findFirst()
                .or(() -> candidates.stream()
                        .filter(IntegrationConnectionProfile::isEnabled)
                        .findFirst())
                .map(this::credentialsOf)
                .flatMap(optional -> optional);
    }

    private Optional<TelegramCredentials> credentialsOf(IntegrationConnectionProfile profile) {
        String sealed = profile.getEncryptedCredentials();
        if (sealed == null || sealed.isBlank()) {
            return emptyCredentials(profile, "encrypted credentials are absent");
        }
        try {
            JsonNode credentials = mapper.readTree(encryption.decrypt(sealed));
            String botToken = credentials.path("botToken").asText(null);
            if (botToken == null || botToken.isBlank()) {
                return emptyCredentials(profile, "decrypted credentials carry no botToken");
            }
            if (!TelegramCredentials.isValidTokenFormat(botToken)) {
                return emptyCredentials(profile, "stored bot token fails the format validation");
            }
            return Optional.of(new TelegramCredentials(botToken, botNameOf(profile)));
        } catch (IOException | IllegalStateException failure) {
            // Decrypt is fail-closed on tampered/wrong-key ciphertext — never
            // a plaintext fallback (ADR-027). The failure message carries no
            // secret material; malformed stored JSON is treated the same.
            return emptyCredentials(profile,
                    "credential resolution failed: " + failure.getMessage());
        }
    }

    /** Non-secret display name from the profile config JSON (optional). */
    private String botNameOf(IntegrationConnectionProfile profile) {
        String config = profile.getConfig();
        if (config == null || config.isBlank()) {
            return null;
        }
        try {
            return mapper.readTree(config).path("botName").asText(null);
        } catch (IOException ignored) {
            return null;
        }
    }

    private Optional<TelegramCredentials> emptyCredentials(IntegrationConnectionProfile profile,
            String reason) {
        // Logs reference the profile id + reason only — never token material.
        log.warn("Telegram credential resolution failed for profile {}: {}",
                profile.getId(), reason);
        return Optional.empty();
    }
}
