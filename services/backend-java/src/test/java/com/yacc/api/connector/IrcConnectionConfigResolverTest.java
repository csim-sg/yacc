package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Base64;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.api.integration.EncryptionProperties;
import com.yacc.api.integration.IrcConfigService;
import com.yacc.api.integration.Profile;
import com.yacc.api.integration.StoredConfig;
import com.yacc.entity.IntegrationConnectionProfile;
import com.yacc.repository.IntegrationConnectionProfileRepository;
import com.yacc.service.EncryptionService;

/**
 * DB-first IRC connection resolution tests (MIG-061; AC-MIG-061-1; baseline
 * INT-010 gating parity). Real AES-256-GCM round-trips through
 * {@link EncryptionService} (the existing cipher — evidence, not new
 * crypto), mocked repository + single-config service. Fail-closed: absent
 * profiles, undecryptable ciphertext and the no-active-profile multi-profile
 * state all resolve to empty.
 */
class IrcConnectionConfigResolverTest {

    private static final String PASSWORD_JSON = "{\"password\":\"s3cret-password\"}";

    private IntegrationConnectionProfileRepository profiles;
    private IrcConfigService ircConfigService;
    private EncryptionService encryption;
    private ObjectMapper mapper;

    private IrcConnectionConfigResolver resolver;

    @BeforeEach
    void setUp() {
        profiles = mock(IntegrationConnectionProfileRepository.class);
        ircConfigService = mock(IrcConfigService.class);
        encryption = new EncryptionService(new EncryptionProperties(base64Key((byte) 1)));
        mapper = new ObjectMapper();
        resolver = new IrcConnectionConfigResolver(profiles, ircConfigService, encryption,
                mapper);
    }

    @Test
    void resolvesTheActiveProfileWithDecryptedPassword() {
        IntegrationConnectionProfile active = profile(
                encryption.encrypt(PASSWORD_JSON),
                "{\"server\":\"irc.fixture.local\",\"port\":6667,"
                        + "\"username\":\"yaccbot\",\"channels\":[\"#test\"]}");
        active.setActive(true);
        IntegrationConnectionProfile inactive = profile(
                encryption.encrypt(PASSWORD_JSON),
                "{\"server\":\"other.local\",\"port\":6668,"
                        + "\"username\":\"other\",\"channels\":[\"#x\"]}");
        when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "irc"))
                .thenReturn(List.of(inactive, active));

        Optional<IrcConnectionConfig> resolved = resolver.resolve();

        assertThat(resolved).isPresent();
        IrcConnectionConfig config = resolved.get();
        assertThat(config.server()).isEqualTo("irc.fixture.local");
        assertThat(config.port()).isEqualTo(6667);
        assertThat(config.nick()).isEqualTo("yaccbot");
        assertThat(config.password()).isEqualTo("s3cret-password");
        assertThat(config.channels()).containsExactly("#test");
        assertThat(config.profileId()).isEqualTo(active.getId());
    }

    @Test
    void singleInactiveProfileIsUsedImplicitly() {
        IntegrationConnectionProfile only = profile(
                encryption.encrypt(PASSWORD_JSON),
                "{\"server\":\"irc.fixture.local\",\"port\":6697,"
                        + "\"username\":\"yaccbot\",\"channels\":[\"#ops\"]}");
        when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "irc"))
                .thenReturn(List.of(only));

        Optional<IrcConnectionConfig> resolved = resolver.resolve();

        assertThat(resolved).isPresent();
        assertThat(resolved.get().server()).isEqualTo("irc.fixture.local");
        assertThat(resolved.get().port()).isEqualTo(6697);
    }

    @Test
    void multipleProfilesWithoutActiveFailClosed() {
        IntegrationConnectionProfile first = profile(
                encryption.encrypt(PASSWORD_JSON),
                "{\"server\":\"a.local\",\"port\":6667,"
                        + "\"username\":\"a\",\"channels\":[\"#a\"]}");
        IntegrationConnectionProfile second = profile(
                encryption.encrypt(PASSWORD_JSON),
                "{\"server\":\"b.local\",\"port\":6667,"
                        + "\"username\":\"b\",\"channels\":[\"#b\"]}");
        when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "irc"))
                .thenReturn(List.of(first, second));

        assertThat(resolver.resolve()).isEmpty();
    }

    @Test
    void noProfilesFallBackToTheSingleConfigStore() {
        when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "irc"))
                .thenReturn(List.of());
        when(ircConfigService.storedConfig()).thenReturn(Optional.of(new StoredConfig(
                "single.local", 6667, "yaccbot", "store-password", List.of("#one"), "db")));

        Optional<IrcConnectionConfig> resolved = resolver.resolve();

        assertThat(resolved).isPresent();
        assertThat(resolved.get().server()).isEqualTo("single.local");
        assertThat(resolved.get().password()).isEqualTo("store-password");
        assertThat(resolved.get().profileId()).isNull();
    }

    @Test
    void nothingConfiguredResolvesEmpty() {
        when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "irc"))
                .thenReturn(List.of());
        when(ircConfigService.storedConfig()).thenReturn(Optional.empty());

        assertThat(resolver.resolve()).isEmpty();
    }

    @Test
    void undecryptableCredentialsFailClosed() {
        // Ciphertext produced under a different key fails authentication.
        EncryptionService otherKey = new EncryptionService(
                new EncryptionProperties(base64Key((byte) 9)));
        IntegrationConnectionProfile active = profile(
                otherKey.encrypt(PASSWORD_JSON),
                "{\"server\":\"irc.fixture.local\",\"port\":6667,"
                        + "\"username\":\"yaccbot\",\"channels\":[\"#test\"]}");
        active.setActive(true);
        when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "irc"))
                .thenReturn(List.of(active));

        assertThat(resolver.resolve()).isEmpty();
    }

    @Test
    void missingPasswordResolvesToANullPasswordConfig() {
        IntegrationConnectionProfile active = profile(null,
                "{\"server\":\"irc.fixture.local\",\"port\":6667,"
                        + "\"username\":\"yaccbot\",\"channels\":[\"#test\"]}");
        active.setActive(true);
        when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "irc"))
                .thenReturn(List.of(active));

        Optional<IrcConnectionConfig> resolved = resolver.resolve();

        assertThat(resolved).isPresent();
        assertThat(resolved.get().password()).isNull();
    }

    @Test
    void blankStoredPasswordResolvesToNull() {
        IntegrationConnectionProfile active = profile(
                encryption.encrypt("{\"password\":\"\"}"),
                "{\"server\":\"irc.fixture.local\",\"port\":6667,"
                        + "\"username\":\"yaccbot\",\"channels\":[\"#test\"]}");
        active.setActive(true);
        when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "irc"))
                .thenReturn(List.of(active));

        Optional<IrcConnectionConfig> resolved = resolver.resolve();

        assertThat(resolved).isPresent();
        assertThat(resolved.get().password()).isNull();
    }

    @Test
    void profileConfigWithoutPortDefaultsTo6667() {
        IntegrationConnectionProfile active = profile(null,
                "{\"server\":\"irc.fixture.local\",\"username\":\"yaccbot\","
                        + "\"channels\":[\"#test\"]}");
        active.setActive(true);
        when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "irc"))
                .thenReturn(List.of(active));

        Optional<IrcConnectionConfig> resolved = resolver.resolve();

        assertThat(resolved).isPresent();
        assertThat(resolved.get().port()).isEqualTo(6667);
    }

    @Test
    void profileWithoutServerOrNickFailsClosed() {
        IntegrationConnectionProfile active = profile(null, "{}");
        active.setActive(true);
        when(profiles.findByTenantIdAndIntegrationType(
                IntegrationConnectionProfile.DEFAULT_TENANT_ID, "irc"))
                .thenReturn(List.of(active));

        assertThat(resolver.resolve()).isEmpty();
    }

    // --- harness ---

    private IntegrationConnectionProfile profile(String sealedCredentials, String configJson) {
        IntegrationConnectionProfile profile = new IntegrationConnectionProfile(
                "irc", "fixture-profile", sealedCredentials, configJson);
        profile.setEnabled(true);
        return profile;
    }

    private static String base64Key(byte fill) {
        byte[] key = new byte[32];
        for (int i = 0; i < key.length; i++) {
            key[i] = fill;
        }
        return Base64.getEncoder().encodeToString(key);
    }
}
