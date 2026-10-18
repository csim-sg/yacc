package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * MIG-062 D1 registry unit tests (guardrail G1): thin platform&rarr;connector
 * lookup with the baseline {@code register}/{@code getPlatforms}/
 * {@code disconnectAll} surface, absence reporting, and the
 * {@code adapter:registered} hook fire point. Startup registration into the
 * booted context is exercised by {@code GatewayExchangeInboundIntegrationTest}.
 */
class ConnectorRegistryTest {

    private GatewayHooks hooks;
    private ConnectorRegistry registry;
    private PlatformConnector telegram;
    private PlatformConnector irc;

    @BeforeEach
    void setUp() {
        hooks = mock(GatewayHooks.class);
        registry = new ConnectorRegistry(hooks);
        telegram = mock(PlatformConnector.class);
        irc = mock(PlatformConnector.class);
    }

    @Test
    void lookupResolvesRegisteredPlatformsAndReportsAbsence() {
        registry.register("telegram", telegram);
        registry.register("irc", irc);

        assertThat(registry.get("telegram")).contains(telegram);
        assertThat(registry.get("irc")).contains(irc);
        assertThat(registry.get("slack")).isEmpty();
        assertThat(registry.isRegistered("telegram")).isTrue();
        assertThat(registry.isRegistered("slack")).isFalse();
        assertThat(registry.platforms()).containsExactlyInAnyOrder("telegram", "irc");
    }

    @Test
    void registrationFiresTheAdapterRegisteredHook() {
        registry.register("telegram", telegram);

        verify(hooks).fire(GatewayHooks.ADAPTER_REGISTERED, "telegram");
    }

    @Test
    void disconnectAllDisconnectsEveryConnectorAndIsolatesFailures() {
        registry.register("telegram", telegram);
        registry.register("irc", irc);
        org.mockito.Mockito.doThrow(new IllegalStateException("dead socket"))
                .when(telegram).disconnect();

        registry.disconnectAll();

        verify(telegram).disconnect();
        verify(irc).disconnect();
    }

    @Test
    void overwriteIsWarnedAndTheLastRegistrationWins() {
        registry.register("telegram", telegram);
        PlatformConnector replacement = mock(PlatformConnector.class);

        registry.register("telegram", replacement);

        assertThat(registry.get("telegram")).contains(replacement);
        verify(hooks, org.mockito.Mockito.times(2)).fire(
                GatewayHooks.ADAPTER_REGISTERED, "telegram");
    }

    /** Compile-time shape check: the merged connectors satisfy the seam. */
    @Test
    void bothMergedConnectorsSatisfyThePlatformNeutralSeam() {
        assertThat(PlatformConnector.class).isAssignableFrom(TelegramConnector.class);
        assertThat(PlatformConnector.class).isAssignableFrom(IrcConnector.class);
        assertThat(Optional.of("telegram")).contains(TelegramConnector.PLATFORM);
        assertThat(List.of("irc")).contains(IrcConnector.PLATFORM);
    }
}
