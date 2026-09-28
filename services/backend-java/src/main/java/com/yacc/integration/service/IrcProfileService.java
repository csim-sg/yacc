package com.yacc.integration.service;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;
import com.yacc.common.controller.IntegrationApiException;
import com.yacc.common.controller.NotFoundException;
import com.yacc.integration.model.IntegrationConnectionProfile;
import com.yacc.integration.model.Profile;
import com.yacc.integration.model.ProfileResponse;
import com.yacc.integration.model.ProfileTestResult;
import com.yacc.integration.model.ProfileWrite;
import com.yacc.integration.repository.IntegrationConnectionProfileRepository;

/**
 * Multi-profile IRC connection profiles (ledger rows REST-IRCPROF-001..008;
 * ADR-017 multi-profile DB-first model, ADR-027 AES-256-GCM credentials;
 * POC {@code ircProfile.service} parity): 0..10 profiles per tenant, at
 * most one active per integration, disable-clears-active, credential
 * encryption at rest, no secrets in responses, side-effect-free stored-
 * credential tests.
 */
@Service
public class IrcProfileService {

    private static final int PROFILE_CAP = 10;
    private static final Duration TEST_TIMEOUT = Duration.ofSeconds(10);

    private final IntegrationConnectionProfileRepository profiles;
    private final EncryptionService encryption;
    private final AuditPersistence audit;
    private final ObjectMapper mapper;

    public IrcProfileService(IntegrationConnectionProfileRepository profiles,
            EncryptionService encryption, AuditPersistence audit, ObjectMapper mapper) {
        this.profiles = profiles;
        this.encryption = encryption;
        this.audit = audit;
        this.mapper = mapper;
    }

    /** Creates a profile (encrypted credentials; starts inactive). */
    @Transactional
    public ProfileResponse create(String tenantId, ProfileWrite request, String actorId) {
        List<IntegrationConnectionProfile> existing = profiles
                .findByTenantIdAndIntegrationType(java.util.UUID.fromString(tenantId), "irc");
        if (existing.size() >= PROFILE_CAP) {
            throw new IntegrationApiException("profile_limit_exceeded", 409,
                    "IRC profile limit exceeded (cap: " + PROFILE_CAP + ")");
        }
        IntegrationConnectionProfile profile = new IntegrationConnectionProfile(
                "irc", request.name(),
                encryption.encrypt(secretJson(request.password())),
                configJson(request));
        profile.setCreatedById(actorId);
        profile.setUpdatedById(actorId);
        IntegrationConnectionProfile saved = profiles.save(profile);
        auditProfile(actorId, "create", saved, builder -> builder.put("profileName", saved.getName()));
        return toResponse(saved);
    }

    /** All IRC profiles of the tenant (raw array, no secrets). */
    @Transactional(readOnly = true)
    public List<ProfileResponse> list(String tenantId) {
        return profiles.findByTenantIdAndIntegrationType(java.util.UUID.fromString(tenantId), "irc").stream()
                .map(this::toResponse)
                .toList();
    }

    /** One profile by numeric id (404 when absent). */
    @Transactional(readOnly = true)
    public ProfileResponse get(String tenantId, int id) {
        return toResponse(fetch(tenantId, id));
    }

    /** Updates name/config/password/enabled; disabling clears active. */
    @Transactional
    public ProfileResponse update(String tenantId, int id, ProfileWrite request, String actorId) {
        IntegrationConnectionProfile profile = fetch(tenantId, id);
        if (request.enabled() != null && !request.enabled() && profile.isActive()) {
            profile.setEnabled(false);
            profile.setActive(false);
            profile.setUpdatedById(actorId);
            profile.setUpdatedAt(LocalDateTime.now());
            return toResponse(profiles.save(profile));
        }
        if (request.name() != null) {
            profile.setName(request.name());
        }
        if (request.server() != null || request.port() != null || request.nick() != null
                || request.channels() != null) {
            Profile current = parseConfig(profile.getConfig());
            Profile merged = new Profile(
                    request.server() != null ? request.server() : current.server(),
                    request.port() != null ? request.port() : current.port(),
                    request.nick() != null ? request.nick() : current.username(),
                    request.channels() != null ? request.channels() : current.channels());
            profile.setConfig(toJson(merged));
        }
        if (request.password() != null) {
            profile.setEncryptedCredentials(encryption.encrypt(secretJson(request.password())));
        }
        if (request.enabled() != null) {
            profile.setEnabled(request.enabled());
        }
        profile.setUpdatedById(actorId);
        profile.setUpdatedAt(LocalDateTime.now());
        IntegrationConnectionProfile saved = profiles.save(profile);
        auditProfile(actorId, "update", saved, builder -> builder.put("profileName", saved.getName()));
        return toResponse(saved);
    }

    /** Activates the profile and deactivates the previous single active. */
    @Transactional
    public ProfileResponse activate(String tenantId, int id, String actorId) {
        IntegrationConnectionProfile profile = fetch(tenantId, id);
        if (!profile.isEnabled()) {
            throw new IntegrationApiException("cannot_activate_disabled", 409,
                    "Cannot activate a disabled profile");
        }
        profiles.findByTenantIdAndIntegrationType(java.util.UUID.fromString(tenantId), "irc").stream()
                .filter(IntegrationConnectionProfile::isActive)
                .forEach(active -> {
                    active.setActive(false);
                    active.setUpdatedById(actorId);
                    profiles.save(active);
                });
        profile.setActive(true);
        profile.setUpdatedById(actorId);
        profile.setUpdatedAt(LocalDateTime.now());
        IntegrationConnectionProfile saved = profiles.save(profile);
        auditProfile(actorId, "activate", saved, builder -> {
        });
        return toResponse(saved);
    }

    /** Disables the profile (clears active). */
    @Transactional
    public ProfileResponse disable(String tenantId, int id, String actorId) {
        IntegrationConnectionProfile profile = fetch(tenantId, id);
        profile.setEnabled(false);
        profile.setActive(false);
        profile.setUpdatedById(actorId);
        profile.setUpdatedAt(LocalDateTime.now());
        IntegrationConnectionProfile saved = profiles.save(profile);
        auditProfile(actorId, "disable", saved, builder -> {
        });
        return toResponse(saved);
    }

    /** Deletes the profile; 404 when absent. */
    @Transactional
    public void delete(String tenantId, int id, String actorId) {
        IntegrationConnectionProfile profile = fetch(tenantId, id);
        profiles.delete(profile);
        auditProfile(actorId, "delete", profile, builder -> {
        });
    }

    /** Tests the stored credentials without switching the active profile. */
    @Transactional
    public ProfileTestResult test(String tenantId, int id) {
        IntegrationConnectionProfile profile = fetch(tenantId, id);
        Profile config = parseConfig(profile.getConfig());
        long startedAt = System.nanoTime();
        boolean passed;
        String reason;
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(config.server(), config.port()),
                    (int) TEST_TIMEOUT.toMillis());
            passed = true;
            reason = "Connected to " + config.server() + ":" + config.port();
        } catch (IOException failure) {
            passed = false;
            reason = "Connection failed: " + failure.getClass().getSimpleName();
        }
        long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;
        profile.setLastTestedAt(LocalDateTime.now());
        profile.setLastTestPassed(passed);
        profiles.save(profile);
        return new ProfileTestResult(passed, reason, elapsedMs);
    }

    private IntegrationConnectionProfile fetch(String tenantId, int id) {
        return profiles.findById(id)
                .filter(profile -> tenantId.equals(String.valueOf(profile.getTenantId()))
                        && "irc".equals(profile.getIntegrationType()))
                .orElseThrow(() -> new NotFoundException("Profile not found"));
    }

    private ProfileResponse toResponse(IntegrationConnectionProfile profile) {
        Profile config = parseConfig(profile.getConfig());
        return new ProfileResponse(profile.getId(), profile.getName(), profile.isEnabled(),
                profile.isActive(), config, profile.getEncryptedCredentials() != null
                        && !profile.getEncryptedCredentials().isBlank(),
                        profile.getLastTestedAt(), profile.getLastTestPassed(),
                        profile.getCreatedAt(), profile.getUpdatedAt());
    }

    private void auditProfile(String actorId, String action,
            IntegrationConnectionProfile profile,
            java.util.function.Consumer<com.fasterxml.jackson.databind.node.ObjectNode> shape) {
        com.fasterxml.jackson.databind.node.ObjectNode metadata = mapper.createObjectNode();
        shape.accept(metadata);
        audit.persist(new AuditRecord(action, "integration", "irc-profile-" + profile.getId(),
                actorId, metadata, null));
    }

    private String secretJson(String password) {
        try {
            return mapper.writeValueAsString(java.util.Map.of("password", password == null ? "" : password));
        } catch (IOException ignored) {
            return "{}";
        }
    }

    private String configJson(ProfileWrite request) {
        return toJson(new Profile(request.server(), request.port(), request.nick(),
                request.channels() == null ? List.of() : request.channels()));
    }

    private String toJson(Profile config) {
        try {
            return mapper.writeValueAsString(config);
        } catch (IOException ignored) {
            return "{}";
        }
    }

    private Profile parseConfig(String json) {
        if (json == null) {
            return new Profile(null, null, null, List.of());
        }
        try {
            return mapper.readValue(json, Profile.class);
        } catch (IOException ignored) {
            return new Profile(null, null, null, List.of());
        }
    }
}
