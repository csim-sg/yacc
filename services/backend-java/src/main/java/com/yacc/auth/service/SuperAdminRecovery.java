package com.yacc.auth.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.auth.AuthProperties;
import com.yacc.auth.model.User;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Founder-controlled recovery for post-live Super Admin lockout (MIG-030;
 * ADR-025). Out-of-band, manual, founder-owned — never reachable via the
 * normal API. KISS default per ADR-025: an env-gated restart flag. A
 * startup armed with {@code RECOVERY_MODE=once} and a founder-presented
 * {@code RECOVERY_KEY} re-provisions the bootstrap Super Admin —
 * {@code SUPER_ADMIN} role, {@code active} status, a fresh one-time
 * credential (never a restored old one), forced password change — and is
 * audit-logged on every use. The presented key is accepted only when its
 * SHA-256 digest matches the founder-pinned {@code YACC_RECOVERY_KEY_HASH};
 * the comparison is constant-time. The founder alone holds the preimage.
 *
 * <p>Fail-closed: an armed startup with wrong configuration or a wrong key
 * refuses to start rather than booting half-recovered. Runs before the
 * first-run bootstrap, which then no-ops because the Super Admin exists.</p>
 */
@Component
@Order(0)
public class SuperAdminRecovery implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(SuperAdminRecovery.class);

    private final AuthProperties properties;
    private final SuperAdminProvisioner provisioner;
    private final AuditPersistence audit;

    public SuperAdminRecovery(
            AuthProperties properties,
            SuperAdminProvisioner provisioner,
            AuditPersistence audit) {
        this.properties = properties;
        this.provisioner = provisioner;
        this.audit = audit;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        AuthProperties.Recovery recovery = properties.recovery();
        if (recovery.mode() == null || recovery.mode().isBlank()) {
            return;
        }
        if (!AuthProperties.Recovery.MODE_ONCE.equals(recovery.mode())) {
            throw new IllegalStateException(
                    "RECOVERY_MODE must be '" + AuthProperties.Recovery.MODE_ONCE
                            + "' or unset; got '" + recovery.mode() + "' (ADR-025)");
        }
        LOG.warn("RECOVERY_MODE=once armed — attempting founder-controlled recovery");
        if (recovery.key() == null || recovery.key().isBlank()
                || recovery.keyHash() == null || recovery.keyHash().isBlank()) {
            throw new IllegalStateException(
                    "Recovery armed but RECOVERY_KEY or YACC_RECOVERY_KEY_HASH is missing"
                            + " (fail-closed; ADR-025)");
        }
        requireValidKey(recovery);
        AuthProperties.Bootstrap bootstrap = properties.bootstrap();
        if (bootstrap.email() == null || bootstrap.email().isBlank()
                || bootstrap.initialCredential() == null
                || bootstrap.initialCredential().isBlank()) {
            throw new IllegalStateException(
                    "Recovery requires YACC_BOOTSTRAP_SUPER_ADMIN_EMAIL and"
                            + " YACC_BOOTSTRAP_SUPER_ADMIN_INITIAL_CREDENTIAL to re-provision"
                            + " the Super Admin with a fresh credential (ADR-025)");
        }
        User recovered = provisioner.provision(bootstrap.email(), bootstrap.initialCredential());
        audit.persist(new AuditRecord("recovery.super_admin.reprovisioned", "user",
                recovered.getId(), recovered.getId(), null, java.time.Instant.now()));
        LOG.warn("Founder-controlled recovery re-provisioned Super Admin identity {};"
                + " forced password change armed. UNSET RECOVERY_MODE now —"
                + " the flag applies to this startup only", recovered.getId());
    }

    private static void requireValidKey(AuthProperties.Recovery recovery) {
        String presentedDigest = sha256Hex(recovery.key());
        boolean matches = MessageDigest.isEqual(
                presentedDigest.getBytes(StandardCharsets.US_ASCII),
                recovery.keyHash().trim().toLowerCase().getBytes(StandardCharsets.US_ASCII));
        if (!matches) {
            throw new IllegalStateException(
                    "Recovery key rejected: presented RECOVERY_KEY does not match the"
                            + " founder-pinned YACC_RECOVERY_KEY_HASH (fail-closed; ADR-025)");
        }
    }

    private static String sha256Hex(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
