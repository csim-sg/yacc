package com.yacc.integration.service;

import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;
import com.yacc.integration.EncryptionProperties;

/**
 * AES-256-GCM encryption for integration credentials (MIG-021; ADR-027).
 *
 * <p>Cipher: {@code AES/GCM/NoPadding} with a 128-bit authentication tag.
 * Every {@link #encrypt(String)} call draws a fresh random 12-byte IV from
 * {@link SecureRandom} — IVs are never reused and never derived from the key.
 * The wire format is {@code base64(iv[0..11] || ciphertext || tag)}; no
 * POC-format ciphertext is read or written (full reset, ADR-027).</p>
 *
 * <p>The master key comes from {@link EncryptionProperties} (env/K8s Secret
 * contract) and is validated eagerly at construction: a missing or
 * wrong-sized key fails startup (fail-closed), never a silent fallback.</p>
 */
@Service
public class EncryptionService {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int IV_BYTES = 12;
    private static final int KEY_BYTES = 32;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public EncryptionService(EncryptionProperties properties) {
        this.key = parseKey(properties.masterKey());
    }

    private static SecretKeySpec parseKey(String masterKeyBase64) {
        if (masterKeyBase64 == null || masterKeyBase64.isBlank()) {
            throw new IllegalStateException(
                    EncryptionProperties.MASTER_KEY_PROPERTY + " is not configured"
                            + " (env YACC_INTEGRATION_ENCRYPTION_MASTER_KEY); refusing to start"
                            + " without key material (fail-closed, ADR-027)");
        }
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(masterKeyBase64.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(
                    EncryptionProperties.MASTER_KEY_PROPERTY + " is not valid base64", e);
        }
        if (keyBytes.length != KEY_BYTES) {
            throw new IllegalStateException(
                    EncryptionProperties.MASTER_KEY_PROPERTY + " must decode to " + KEY_BYTES
                            + " bytes (AES-256); got " + keyBytes.length);
        }
        return new SecretKeySpec(keyBytes, "AES");
    }

    /**
     * Encrypts {@code plaintext} under a fresh random IV.
     *
     * @return base64({@code iv || ciphertext || gcm-tag})
     */
    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(java.nio.charset.StandardCharsets.UTF_8));

            byte[] sealed = new byte[IV_BYTES + ciphertext.length];
            System.arraycopy(iv, 0, sealed, 0, IV_BYTES);
            System.arraycopy(ciphertext, 0, sealed, IV_BYTES, ciphertext.length);
            return Base64.getEncoder().encodeToString(sealed);
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException("AES-256-GCM encryption failed", e);
        }
    }

    /**
     * Decrypts {@code sealed} produced by {@link #encrypt(String)}.
     *
     * @throws IllegalStateException when the ciphertext fails authentication
     *         (tampered, truncated, or wrong key)
     */
    public String decrypt(String sealed) {
        try {
            byte[] bytes = Base64.getDecoder().decode(sealed);
            if (bytes.length <= IV_BYTES) {
                throw new IllegalStateException("Ciphertext too short");
            }
            GCMParameterSpec spec = new GCMParameterSpec(GCM_TAG_BITS, bytes, 0, IV_BYTES);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, spec);
            byte[] plaintext = cipher.doFinal(bytes, IV_BYTES, bytes.length - IV_BYTES);
            return new String(plaintext, java.nio.charset.StandardCharsets.UTF_8);
        } catch (java.security.GeneralSecurityException
                | java.nio.BufferUnderflowException
                | IllegalArgumentException e) {
            throw new IllegalStateException("AES-256-GCM decryption failed"
                    + " (tampered ciphertext or wrong key)", e);
        }
    }
}
