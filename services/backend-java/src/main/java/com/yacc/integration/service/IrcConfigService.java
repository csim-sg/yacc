package com.yacc.integration.service;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.common.controller.IntegrationApiException;
import com.yacc.common.model.IntegrationErrorResponse;
import com.yacc.integration.EncryptionProperties;
import com.yacc.integration.model.IrcConfigResponse;
import com.yacc.integration.model.IrcConfigRequest;
import com.yacc.integration.model.IntegrationConfig;
import com.yacc.integration.repository.IntegrationConfigRepository;

/**
 * IRC configuration + connection lifecycle (ledger rows
 * REST-IRCCONN-001..004; POC {@code ircConfig.service} +
 * {@code ircIntegration.service} parity): encrypted config persistence
 * (AES-256-GCM, ADR-027), DB-first config resolution (the env fallback is
 * owned by the MIG-061 connector configuration), body-first side-effect-free
 * connection tests with a hard 10s timeout, and the manual-connect state
 * reset.
 */
@Service
public class IrcConfigService {

    /** Hard test timeout (frozen ledger parity: 10s). */
    private static final Duration TEST_TIMEOUT = Duration.ofSeconds(10);

    private final IntegrationConfigRepository configs;
    private final EncryptionService encryption;
    private final IrcConnectionState connectionState;
    private final ObjectMapper mapper;

    public IrcConfigService(IntegrationConfigRepository configs, EncryptionService encryption,
            IrcConnectionState connectionState, ObjectMapper mapper) {
        this.configs = configs;
        this.encryption = encryption;
        this.connectionState = connectionState;
        this.mapper = mapper;
    }

    /** Upserts the IRC config, encrypting the optional password at rest. */
    @Transactional
    public IrcConfigResponse saveConfig(String updatedById, IrcConfigRequest request) {
        List<String> channels = request.channels().stream()
                .map(channel -> channel.toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
        IntegrationConfig config = configs.findByPlatform("irc")
                .orElseGet(() -> new IntegrationConfig("irc", request.server(), request.port(),
                        request.username(), "[]"));
        config.setServer(request.server());
        config.setPort(request.port());
        config.setUsername(request.username());
        config.setChannels(toJson(channels));
        config.setUpdatedById(updatedById);
        if (request.password() != null && !request.password().isBlank()) {
            // EncryptionService is fail-closed at construction (ADR-027): the
            // bean only exists with a valid master key, so encryption is
            // always available here.
            config.setPasswordEncrypted(encryption.encrypt(request.password()));
            config.setHasPassword(true);
            config.setPasswordUpdatedAt(LocalDateTime.now());
        }
        config.setUpdatedAt(LocalDateTime.now());
        IntegrationConfig saved = configs.save(config);
        return new IrcConfigResponse(saved.getServer(), saved.getPort(), saved.getUsername(),
                channels, saved.isHasPassword(), saved.getUpdatedAt());
    }

    /** Stored IRC config (DB-first), or empty when unconfigured. */
    @Transactional(readOnly = true)
    public Optional<StoredConfig> storedConfig() {
        return configs.findByPlatform("irc").map(config -> new StoredConfig(
                config.getServer(), config.getPort(), config.getUsername(),
                config.isHasPassword() && config.getPasswordEncrypted() != null
                        ? encryption.decrypt(config.getPasswordEncrypted()) : null,
                fromJson(config.getChannels()), "db"));
    }

    /** Manual connect: resolve config, reset state to retrying/attempt 0. */
    @Transactional
    public Optional<StoredConfig> prepareConnect() {
        Optional<StoredConfig> config = storedConfig();
        config.ifPresent(stored -> connectionState.setManualRetrying());
        return config;
    }

    /**
     * Body-first, side-effect-free connection test (hard 10s timeout).
     * Partial bodies are rejected; empty bodies fall back to the stored
     * config (409 when none).
     */
    @Transactional(readOnly = true)
    public TestResult test(TestRequest request) {
        boolean hasBody = request != null
                && (request.server() != null || request.port() != null || request.username() != null);
        StoredConfig config;
        if (hasBody) {
            if (request.server() == null || request.port() == null || request.username() == null) {
                throw new IntegrationApiException(IntegrationErrorResponse.VALIDATION_ERROR, 400,
                        "Partial configuration provided: server, port, and username are required");
            }
            config = new StoredConfig(request.server(), request.port(), request.username(),
                    request.password(), List.of(), "body");
        } else {
            config = storedConfig().orElseThrow(() ->
                    new IntegrationApiException(IntegrationErrorResponse.IRC_NOT_CONFIGURED, 409,
                            "IRC is not configured. Save configuration first."));
        }
        long startedAt = System.nanoTime();
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(config.server(), config.port()),
                    (int) TEST_TIMEOUT.toMillis());
            long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;
            return new TestResult(true, "Connected to " + config.server() + ":" + config.port()
                    + " in " + elapsedMs + "ms", config.source());
        } catch (IOException failure) {
            throw new IntegrationApiException(IntegrationErrorResponse.INTERNAL_ERROR, 500,
                    "Connection test failed");
        }
    }

    /** Connection status (works unconfigured; never exposes secrets). */
    public com.yacc.integration.model.IrcConnectionStatus status() {
        return connectionState.snapshot();
    }

    private String toJson(List<String> channels) {
        try {
            return mapper.writeValueAsString(channels);
        } catch (IOException ignored) {
            return "[]";
        }
    }

    private List<String> fromJson(String json) {
        if (json == null) {
            return List.of();
        }
        try {
            return mapper.readValue(json, new TypeReference<List<String>>() {
            });
        } catch (IOException ignored) {
            return List.of();
        }
    }

    /** Stored configuration (credential decrypted for the connector only).
     *
     * @param server IRC host
     * @param port IRC port
     * @param username IRC nick/user
     * @param password decrypted password or null
     * @param channels configured channels
     * @param source db | env | body
     */
    public record StoredConfig(String server, int port, String username, String password,
            List<String> channels, String source) {
    }

    /**
     * Body-first test request subset.
     *
     * @param server IRC host
     * @param port IRC port
     * @param username IRC nick/user
     * @param password optional password
     */
    public record TestRequest(String server, Integer port, String username, String password) {
    }

    /**
     * Test outcome.
     *
     * @param success connection established
     * @param message sanitized result message
     * @param source body | db | env
     */
    public record TestResult(boolean success, String message, String source) {
    }
}
