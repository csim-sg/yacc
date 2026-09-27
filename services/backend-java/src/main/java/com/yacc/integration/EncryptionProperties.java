package com.yacc.integration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Encryption key binding for the integration credential encryption service
 * (MIG-021; ADR-027, ARCH-004 §4).
 *
 * <p>The master key is secret material: it is sourced from the environment /
 * K8s Secret contract ({@code YACC_INTEGRATION_ENCRYPTION_MASTER_KEY}, bound
 * at {@code yacc.integration.encryption.master-key}) — never hardcoded, never
 * defaulted. There is deliberately no default value: a blank key fails fast at
 * service construction (fail-closed), because a data layer that cannot
 * encrypt IRC credentials must not run silently unencrypted (ADR-027).</p>
 *
 * <p>The key is base64-encoded and must decode to exactly 32 bytes
 * (AES-256). Key rotation is re-keyed at reset/rotation time by the ops
 * contract (MIG-071 owns rotation drills); this binding carries exactly one
 * active key.</p>
 *
 * @param masterKey base64-encoded 32-byte AES-256 master key
 */
@ConfigurationProperties(prefix = "yacc.integration.encryption")
public record EncryptionProperties(String masterKey) {

    /** Property path the master key binds at (application.yml / env contract). */
    public static final String MASTER_KEY_PROPERTY = "yacc.integration.encryption.master-key";
}
