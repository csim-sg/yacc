package com.yacc.integration.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Base64;
import org.junit.jupiter.api.Test;
import com.yacc.integration.EncryptionProperties;

/**
 * Unit tests for the AES-256-GCM encryption service (MIG-021 AC-MIG-021-2;
 * ADR-027): fresh per-call IV, round-trip fidelity, tamper detection, and
 * fail-closed key validation. No Spring context, no database.
 */
class EncryptionServiceTest {

    private static final String KEY_256 = base64(new byte[32]);
    private static final String KEY_128 = base64(new byte[16]);

    private static String base64(byte[] bytes) {
        byte[] filled = new byte[bytes.length];
        for (int i = 0; i < filled.length; i++) {
            filled[i] = (byte) (i + 1);
        }
        return Base64.getEncoder().encodeToString(filled);
    }

    private EncryptionService service(String masterKey) {
        return new EncryptionService(new EncryptionProperties(masterKey));
    }

    @Test
    void roundTripsPlaintext() {
        EncryptionService service = service(KEY_256);
        String sealed = service.encrypt("irc-password-#1");
        assertThat(service.decrypt(sealed)).isEqualTo("irc-password-#1");
    }

    @Test
    void roundTripsUnicodeAndEmptyPlaintext() {
        EncryptionService service = service(KEY_256);
        assertThat(service.decrypt(service.encrypt("pässwörd ✓"))).isEqualTo("pässwörd ✓");
        assertThat(service.decrypt(service.encrypt(""))).isEmpty();
    }

    @Test
    void everyEncryptionUsesAFreshIvSoCiphertextsDiffer() {
        EncryptionService service = service(KEY_256);
        String first = service.encrypt("same-plaintext");
        String second = service.encrypt("same-plaintext");

        // Fresh IV per call (ADR-027): GCM is deterministic given (key, IV),
        // so identical plaintext with equal IVs would produce equal
        // ciphertext. Different ciphertext therefore proves a fresh IV.
        assertThat(first).isNotEqualTo(second);

        // Both remain independently decryptable.
        assertThat(service.decrypt(first)).isEqualTo("same-plaintext");
        assertThat(service.decrypt(second)).isEqualTo("same-plaintext");
    }

    @Test
    void rejectsTamperedCiphertext() {
        EncryptionService service = service(KEY_256);
        byte[] sealed = Base64.getDecoder().decode(service.encrypt("irc-password"));
        sealed[sealed.length - 1] ^= 0x01; // flip one bit of the GCM tag
        String tampered = Base64.getEncoder().encodeToString(sealed);

        assertThatThrownBy(() -> service.decrypt(tampered))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("decryption failed");
    }

    @Test
    void rejectsWrongKey() {
        byte[] keyBytes = new byte[32];
        keyBytes[0] = 1;
        EncryptionService encryptor = service(Base64.getEncoder().encodeToString(keyBytes));
        keyBytes[0] = 2;
        EncryptionService decryptor = service(Base64.getEncoder().encodeToString(keyBytes));

        assertThatThrownBy(() -> decryptor.decrypt(encryptor.encrypt("secret")))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void failsClosedWhenKeyMissing() {
        assertThatThrownBy(() -> service(null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("yacc.integration.encryption.master-key");
        assertThatThrownBy(() -> service("   "))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void failsClosedWhenKeyIsNotBase64OrWrongSize() {
        assertThatThrownBy(() -> service("not-base64-!!!"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("base64");
        assertThatThrownBy(() -> service(KEY_128))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
    }
}
