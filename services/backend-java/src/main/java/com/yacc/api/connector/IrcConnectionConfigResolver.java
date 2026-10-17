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
import com.yacc.api.integration.IrcConfigService;
import com.yacc.api.integration.Profile;
import com.yacc.api.integration.StoredConfig;
import com.yacc.entity.IntegrationConnectionProfile;
import com.yacc.repository.IntegrationConnectionProfileRepository;
import com.yacc.service.EncryptionService;

/**
 * DB-first IRC connection resolution (AC-MIG-061-1; baseline
 * {@code ircProfileResolution.service} INT-010 gating parity). Selection
 * over the multi-profile model that MIG-021/MIG-040 merged — the connector
 * runtime owns only the selection logic, never the storage, encryption or
 * REST surfaces:
 *
 * <ol>
 *   <li>IRC profiles exist → the <b>active</b> profile wins; with no
 *       active profile a <b>single</b> profile applies implicitly; multiple
 *       profiles without an active one fail closed (baseline
 *       {@code irc_profile_not_selected}).</li>
 *   <li>No profiles → the existing {@link IrcConfigService#storedConfig()}
 *       single-config resolution (the frozen REST-IRCCONN flow, decryption
 *       inside).</li>
 * </ol>
 *
 * <p>Credentials decrypt through the existing
 * {@link EncryptionService#decrypt(String)} (AES-256-GCM, ADR-027 — fresh
 * random 12-byte IV per encrypt, {@code base64(iv‖ciphertext‖tag)}, no POC
 * format). Any resolution/decryption failure returns empty (fail-closed;
 * the connector then refuses to connect) and logs the profile id + reason
 * only — never credential material. No env fallback exists.</p>
 */
@Service
public class IrcConnectionConfigResolver {

    private static final Logger log = LoggerFactory.getLogger(IrcConnectionConfigResolver.class);

    /** Profile {@code integration_type} discriminator for this connector. */
    private static final String INTEGRATION_TYPE = "irc";

    /** Baseline parity default when a profile config carries no port. */
    private static final int DEFAULT_PORT = 6667;

    private final IntegrationConnectionProfileRepository profiles;
    private final IrcConfigService ircConfigService;
    private final EncryptionService encryption;
    private final ObjectMapper mapper;

    public IrcConnectionConfigResolver(IntegrationConnectionProfileRepository profiles,
            IrcConfigService ircConfigService, EncryptionService encryption,
            ObjectMapper mapper) {
        this.profiles = profiles;
        this.ircConfigService = ircConfigService;
        this.encryption = encryption;
        this.mapper = mapper;
    }

    /**
     * Resolves the connection runtime config (DB-first, active profile
     * preferred — see the class contract). Returns empty when nothing
     * eligible resolves; the connector then fails closed.
     */
    @Transactional(readOnly = true)
    public Optional<IrcConnectionConfig> resolve() {
        List<IntegrationConnectionProfile> candidates = profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, INTEGRATION_TYPE);
        if (candidates.isEmpty()) {
            // Baseline INT-010 "zero DB profiles" branch: the single-config
            // store (frozen REST-IRCCONN flow) is the DB fallback surface.
            return ircConfigService.storedConfig().map(this::fromStoredConfig);
        }
        Optional<IntegrationConnectionProfile> selected = candidates.stream()
                .filter(IntegrationConnectionProfile::isActive)
                .findFirst()
                .or(() -> candidates.size() == 1
                        ? Optional.of(candidates.get(0))
                        : Optional.empty());
        if (selected.isEmpty()) {
            // Baseline irc_profile_not_selected parity: multiple profiles,
            // none active — fail closed instead of guessing.
            log.warn("IRC profile resolution failed: {} profiles exist but none is active",
                    candidates.size());
            return Optional.empty();
        }
        return configOf(selected.get());
    }

    private IrcConnectionConfig fromStoredConfig(StoredConfig stored) {
        return new IrcConnectionConfig(stored.server(), stored.port(), stored.username(),
                stored.password(), stored.channels(), null);
    }

    private Optional<IrcConnectionConfig> configOf(IntegrationConnectionProfile profile) {
        Profile config = parseConfig(profile);
        if (config.server() == null || config.server().isBlank()
                || config.username() == null || config.username().isBlank()) {
            return emptyConfig(profile, "stored config carries no server/nick");
        }
        String password;
        try {
            password = decryptPassword(profile);
        } catch (IOException | IllegalStateException failure) {
            // Decrypt is fail-closed on tampered/wrong-key ciphertext — never
            // a plaintext fallback (ADR-027). The failure message carries no
            // secret material; malformed stored JSON is treated the same.
            log.warn("IRC credential resolution failed for profile {}: {}",
                    profile.getId(), failure.getMessage());
            return Optional.empty();
        }
        return Optional.of(new IrcConnectionConfig(config.server(),
                config.port() == null ? DEFAULT_PORT : config.port(), config.username(),
                password, config.channels(), profile.getId()));
    }

    /** Non-secret profile config JSON ({@code server/port/username/channels}). */
    private Profile parseConfig(IntegrationConnectionProfile profile) {
        String config = profile.getConfig();
        if (config == null || config.isBlank()) {
            return new Profile(null, null, null, null);
        }
        try {
            return mapper.treeToValue(mapper.readTree(config), Profile.class);
        } catch (IOException ignored) {
            return new Profile(null, null, null, null);
        }
    }

    /**
     * Decrypts the profile credential blob ({@code {"password": ...}} — the
     * exact shape {@code IrcProfileService} stores). Blank passwords (the
     * stored empty-password convention) resolve to null.
     *
     * @throws IllegalStateException when decryption fails authentication
     * @throws IOException when the decrypted JSON is malformed
     */
    private String decryptPassword(IntegrationConnectionProfile profile)
            throws IOException, IllegalStateException {
        String sealed = profile.getEncryptedCredentials();
        if (sealed == null || sealed.isBlank()) {
            return null;
        }
        JsonNode credentials = mapper.readTree(encryption.decrypt(sealed));
        String password = credentials.path("password").asText(null);
        return password == null || password.isBlank() ? null : password;
    }

    private Optional<IrcConnectionConfig> emptyConfig(IntegrationConnectionProfile profile,
            String reason) {
        // Logs reference the profile id + reason only — never credential material.
        log.warn("IRC profile resolution failed for profile {}: {}", profile.getId(), reason);
        return Optional.empty();
    }
}
