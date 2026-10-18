package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Base64;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.api.integration.EncryptionProperties;
import com.yacc.entity.IntegrationConnectionProfile;
import com.yacc.repository.IntegrationConnectionProfileRepository;
import com.yacc.service.EncryptionService;

/**
 * DB-first Telegram credential resolution tests (MIG-060 guardrail: the bot
 * token comes from {@code IntegrationConnectionProfile} ciphertext decrypted
 * through {@link EncryptionService#decrypt(String)} — never plaintext, never
 * properties). Real AES-256-GCM round-trips, mocked repository. Fail-closed:
 * absent/disabled profiles, absent/malformed tokens, and undecryptable
 * ciphertext all resolve to empty.
 */
class TelegramCredentialsResolverTest {

    /** Matches the baseline token format: 9 digits + ':' + 35 chars. */
    private static final String VALID_TOKEN = "123456789:ABCdefGHIjklMNOpqrSTUvwxy0123456789";

    private static final String OTHER_KEY = base64Key((byte) 9);

    private IntegrationConnectionProfileRepository profiles;
    private EncryptionService encryption;
    private EncryptionService otherKeyEncryption;
    private ObjectMapper mapper;

    private TelegramCredentialsResolver resolver;

    @BeforeEach
    void setUp() {
        profiles = org.mockito.Mockito.mock(IntegrationConnectionProfileRepository.class);
        encryption = new EncryptionService(new EncryptionProperties(base64Key((byte) 1)));
        otherKeyEncryption = new EncryptionService(new EncryptionProperties(OTHER_KEY));
        mapper = new ObjectMapper();
        resolver = new TelegramCredentialsResolver(profiles, encryption, mapper);
    }

    @Test
    void resolvesTheActiveProfileTokenThroughAesDecryption() {
        IntegrationConnectionProfile profile = sealedProfile(VALID_TOKEN, "yacc_bot");
        profile.setActive(true);
        whenFind(profile);

        Optional<TelegramCredentials> resolved = resolver.resolve();

        assertThat(resolved).isPresent();
        assertThat(resolved.get().botToken()).isEqualTo(VALID_TOKEN);
        assertThat(resolved.get().botName()).isEqualTo("yacc_bot");
    }

    @Test
    void fallsBackToTheFirstEnabledProfileWhenNoneIsActive() {
        IntegrationConnectionProfile disabled = sealedProfile(VALID_TOKEN, null);
        IntegrationConnectionProfile enabled = sealedProfile(VALID_TOKEN, null);
        disabled.setEnabled(false);
        whenFind(disabled, enabled);

        Optional<TelegramCredentials> resolved = resolver.resolve();

        assertThat(resolved).isPresent();
        assertThat(resolved.get().botToken()).isEqualTo(VALID_TOKEN);
    }

    @Test
    void resolvesEmptyWhenNoEligibleProfileExists() {
        IntegrationConnectionProfile disabled = sealedProfile(VALID_TOKEN, null);
        disabled.setEnabled(false);
        whenFind(disabled);

        assertThat(resolver.resolve()).isEmpty();
        assertThat(resolver.resolve()).isEmpty();
    }

    @Test
    void resolvesEmptyWhenTheProfileCarriesNoCredentials() {
        IntegrationConnectionProfile profile = new IntegrationConnectionProfile(
                "telegram", "tg", null, "{}");
        profile.setActive(true);
        whenFind(profile);

        assertThat(resolver.resolve()).isEmpty();
    }

    @Test
    void resolvesEmptyWhenTheCiphertextFailsAuthentication() {
        IntegrationConnectionProfile profile = new IntegrationConnectionProfile(
                "telegram", "tg", otherKeyEncryption.encrypt(sealedTokenJson(VALID_TOKEN)), "{}");
        profile.setActive(true);
        whenFind(profile);

        assertThat(resolver.resolve()).isEmpty();
    }

    @Test
    void resolvesEmptyWhenTheStoredTokenIsMalformed() {
        whenFind(sealedProfile("not-a-token", null));

        assertThat(resolver.resolve()).isEmpty();
    }

    @Test
    void resolvesEmptyWhenTheCredentialsJsonCarriesNoToken() {
        IntegrationConnectionProfile profile = new IntegrationConnectionProfile(
                "telegram", "tg", encryption.encrypt("{\"botName\":\"orphan\"}"), "{}");
        profile.setActive(true);
        whenFind(profile);

        assertThat(resolver.resolve()).isEmpty();
    }

    // --- helpers ---

    private IntegrationConnectionProfile sealedProfile(String botToken, String botName) {
        String config = botName == null ? "{}" : "{\"botName\":\"" + botName + "\"}";
        IntegrationConnectionProfile profile = new IntegrationConnectionProfile(
                "telegram", "tg-main", encryption.encrypt(sealedTokenJson(botToken)), config);
        profile.setEnabled(true);
        return profile;
    }

    private String sealedTokenJson(String botToken) {
        return "{\"botToken\":\"" + botToken + "\"}";
    }

    private void whenFind(IntegrationConnectionProfile... found) {
        org.mockito.Mockito.when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "telegram"))
                .thenReturn(List.of(found));
    }

    private static String base64Key(byte fill) {
        byte[] key = new byte[32];
        java.util.Arrays.fill(key, fill);
        return Base64.getEncoder().encodeToString(key);
    }
}
