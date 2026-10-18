package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.ServerSocket;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.yacc.api.integration.IrcConnectionState;
import com.yacc.api.integration.IrcConnectionStatus;

/**
 * IRC connector runtime tests (MIG-061; AC-MIG-061-1/-2) — the transport is
 * the in-test {@link MockIrcServer} (or a closed port for refusal cases), so
 * the real socket/protocol code runs while no IRC network is ever contacted
 * (SPEC-002 testing strategy; ARCH-004 §10). Covers the baseline parity
 * surface: connect/registration/channel-join, status + reconnect lifecycle
 * written into {@link IrcConnectionState} (5 attempts, exponential backoff,
 * stable incident id), outbound {@code PRIVMSG} sanitization, the inbound
 * receiver seam, and the single typed error path invoking the
 * {@link ConnectorErrorHook} seam (MIG-063 implements DLQ/breaker behind
 * it).
 */
class IrcConnectorTest {

    private static final Duration WAIT = Duration.ofSeconds(5);

    private MockIrcServer server;
    private IrcConnectionConfigResolver resolver;
    private ConnectorErrorHook errorHook;
    private final List<IrcInboundMessage> inbound = new CopyOnWriteArrayList<>();
    private IrcConnectionState state;
    private ConnectorStatusListener statusListener = mock(ConnectorStatusListener.class);
    private IrcConnector connector;

    @BeforeEach
    void setUp() {
        resolver = mock(IrcConnectionConfigResolver.class);
        errorHook = mock(ConnectorErrorHook.class);
        state = new IrcConnectionState();
        connector = new IrcConnector(resolver, errorHook, inbound::add,
                new IrcConnectorProperties(2_000, 20L, 60L), state, statusListener);
    }

    @AfterEach
    void tearDown() {
        connector.shutdown();
        if (server != null) {
            server.close();
        }
    }

    private void resolveTo(MockIrcServer target, String password, List<String> channels) {
        when(resolver.resolve()).thenReturn(Optional.of(new IrcConnectionConfig("127.0.0.1",
                target.port(), "yaccbot", password, channels, 7)));
    }

    // --- connect + registration + joins (AC-MIG-061-1) ---

    @Test
    void connectRegistersJoinsAndReportsConnected() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, "s3cret", List.of("#test", "#ops"));

        connector.connect();

        assertThat(server.awaitLineContaining("JOIN #test", WAIT)).isTrue();
        assertThat(server.awaitLineContaining("JOIN #ops", WAIT)).isTrue();
        assertThat(server.receivedLines()).containsSubsequence("PASS s3cret", "NICK yaccbot",
                "USER yaccbot 0 * :yaccbot");
        assertThat(connector.status()).isEqualTo(ConnectorStatus.CONNECTED);
        assertThat(connector.health().healthy()).isTrue();
        IrcConnectionStatus snapshot = state.snapshot();
        assertThat(snapshot.status()).isEqualTo("connected");
        assertThat(snapshot.attemptCount()).isZero();
        assertThat(snapshot.lastConnectedAt()).isNotNull();
        // MIG-062 server-side status surface: the connected transition fires
        // the additive seam.
        verify(statusListener).onStatusChange(IrcConnector.PLATFORM,
                ConnectorStatus.CONNECTED);
    }

    /** MIG-062 G12: the resolved profile id rides on the inbound payload. */
    @Test
    void inboundPrivmsgCarriesTheResolvedProfileId() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, null, List.of("#test"));

        connector.connect();
        server.sendLine(":nick!~nick@irc PRIVMSG #test :profile check");
        long deadline = System.currentTimeMillis() + WAIT.toMillis();
        while (inbound.isEmpty() && System.currentTimeMillis() < deadline) {
            Thread.sleep(20);
        }

        assertThat(inbound).hasSize(1);
        assertThat(inbound.get(0).profileId()).isEqualTo(7);
        assertThat(state.snapshot().reconnectIncidentId()).isNull();
        verify(errorHook, never()).onAdapterError(any());
    }

    @Test
    void connectWithoutConfigFailsClosedWithTheTypedError() {
        when(resolver.resolve()).thenReturn(Optional.empty());

        assertThatThrownBy(connector::connect)
                .isInstanceOf(ConnectorException.class)
                .satisfies(failure -> {
                    ConnectorAdapterError error = ((ConnectorException) failure).getError();
                    assertThat(error.platform()).isEqualTo("irc");
                    assertThat(error.operation()).isEqualTo("connect");
                    assertThat(error.code()).isEqualTo(ConnectorErrorCode.INVALID_CREDENTIALS);
                    assertThat(error.retryable()).isFalse();
                });
        assertThat(connector.status()).isEqualTo(ConnectorStatus.DISCONNECTED);
        assertThat(connector.health().healthy()).isFalse();

        ConnectorAdapterError surfaced = singleSurfacedError();
        assertThat(surfaced.message()).contains("not configured");
    }

    @Test
    void connectWithInvalidConfigSurfacesTheValidationErrorAndSchedulesReconnect() {
        when(resolver.resolve()).thenReturn(Optional.of(new IrcConnectionConfig(
                "127.0.0.1", 0, "yaccbot", null, List.of("#test"), null)));

        assertThatThrownBy(connector::connect)
                .isInstanceOf(ConnectorException.class)
                .satisfies(failure -> assertThat(
                        ((ConnectorException) failure).getError().code())
                        .isEqualTo(ConnectorErrorCode.UNKNOWN_ERROR));
        ConnectorAdapterError surfaced = singleSurfacedError();
        assertThat(surfaced.message()).contains("Port must be a number");
        assertThat(state.snapshot().status()).isEqualTo("retrying");
        connector.disconnect();
        assertThat(state.snapshot().status()).isEqualTo("disconnected");
    }

    @Test
    void passwordMismatchSurfacesInvalidCredentialsOnceAndSchedulesTheFirstRetry()
            throws Exception {
        server = new MockIrcServer();
        server.scriptResponse("NICK ", ":mock.server 464 yaccbot :Password incorrect");
        resolveTo(server, "wrong", List.of("#test"));

        assertThatThrownBy(connector::connect)
                .isInstanceOf(ConnectorException.class)
                .satisfies(failure -> assertThat(
                        ((ConnectorException) failure).getError().code())
                        .isEqualTo(ConnectorErrorCode.INVALID_CREDENTIALS));

        ConnectorAdapterError surfaced = singleSurfacedError();
        assertThat(surfaced.code()).isEqualTo(ConnectorErrorCode.INVALID_CREDENTIALS);
        assertThat(surfaced.retryable()).isFalse();
        IrcConnectionStatus snapshot = state.snapshot();
        assertThat(snapshot.status()).isEqualTo("retrying");
        assertThat(snapshot.attemptCount()).isEqualTo(1);
        assertThat(snapshot.reconnectIncidentId()).isNotNull();

        // The scheduled retry must fail the same way; then stop the cycle.
        connector.disconnect();
        assertThat(state.snapshot().status()).isEqualTo("disconnected");
    }

    // --- reconnect cycle (baseline 5 attempts, backoff, incident id) ---

    @Test
    void reconnectsAfterConnectionLossAndRejoinsOverAFreshSocket() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, null, List.of("#test"));
        connector.connect();
        assertThat(connector.reconnectIncidentId()).isNull();

        server.dropClient();

        // The reconnect attempt re-registers and re-joins over a fresh socket.
        assertThat(server.awaitLineCount("NICK yaccbot", 2, WAIT)).isTrue();
        assertThat(server.awaitJoinCount(2, WAIT)).isTrue();
        assertThat(connector.status()).isEqualTo(ConnectorStatus.CONNECTED);
        assertThat(state.snapshot().status()).isEqualTo("connected");
        assertThat(state.snapshot().lastConnectedAt()).isNotNull();
    }

    @Test
    void reconnectGivesUpAfterExactlyFiveAttemptsAndReportsFailed() throws Exception {
        // Port of a closed server socket → every attempt is refused fast.
        int refusedPort;
        try (ServerSocket closed = new ServerSocket(0)) {
            refusedPort = closed.getLocalPort();
        }
        when(resolver.resolve()).thenReturn(Optional.of(new IrcConnectionConfig("127.0.0.1",
                refusedPort, "yaccbot", null, List.of("#test"), null)));

        assertThatThrownBy(connector::connect)
                .isInstanceOf(ConnectorException.class);

        long deadline = System.currentTimeMillis() + WAIT.toMillis();
        while (System.currentTimeMillis() < deadline
                && !"failed".equals(state.snapshot().status())) {
            Thread.sleep(20);
        }
        IrcConnectionStatus snapshot = state.snapshot();
        assertThat(snapshot.status()).isEqualTo("failed");
        assertThat(snapshot.attemptCount()).isEqualTo(5);
        assertThat(snapshot.lastError()).isNotBlank();
        assertThat(snapshot.reconnectIncidentId()).isNotNull();
        assertThat(connector.status()).isEqualTo(ConnectorStatus.ERROR);
        // Initial manual failure + exactly 5 scheduled retries.
        verify(errorHook, times(6)).onAdapterError(any());
    }

    @Test
    void disconnectCancelsThePendingRetryAndStopsTheCycle() throws Exception {
        server = new MockIrcServer();
        // A long base delay makes the cancelled attempt unambiguous: no
        // second registration may ever arrive.
        connector = new IrcConnector(resolver, errorHook, inbound::add,
                new IrcConnectorProperties(2_000, 5_000L, 6_000L), state, statusListener);
        resolveTo(server, null, List.of("#test"));
        assertThatThrownBy(connector::connect)
                .isInstanceOf(ConnectorException.class);
        assertThat(state.snapshot().status()).isEqualTo("retrying");

        connector.disconnect();
        assertThat(state.snapshot().status()).isEqualTo("disconnected");
        assertThat(state.snapshot().attemptCount()).isZero();

        // Give the cancelled attempt time to (wrongly) fire, then assert
        // no second registration happened.
        Thread.sleep(200);
        assertThat(server.receivedLines())
                .filteredOn(line -> line.startsWith("NICK "))
                .hasSize(1);
    }

    // --- outbound (AC parity: sanitization, recipient, result mapping) ---

    @Test
    void sendMessageDeliversSanitizedPrivmsgWithIrcMessageId() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, null, List.of("#test"));
        connector.connect();

        String body = "line1\r\nline2\n" + "x".repeat(450);
        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "conv-1", "irc:#test", body, "corr-1"));

        assertThat(result.success()).isTrue();
        assertThat(result.error()).isNull();
        assertThat(result.externalMessageId()).startsWith("irc-");
        assertThat(server.awaitLineContaining("PRIVMSG #test :", WAIT)).isTrue();
        String sent = server.receivedLines().stream()
                .filter(line -> line.startsWith("PRIVMSG #test :"))
                .findFirst()
                .orElseThrow();
        String payload = sent.substring("PRIVMSG #test :".length());
        assertThat(payload).doesNotContain("\r").doesNotContain("\n");
        // Baseline parity: every CR/LF char is replaced by one space, then
        // the result is truncated to MAX_MESSAGE_LENGTH.
        assertThat(payload).hasSize(IrcConnector.MAX_MESSAGE_LENGTH)
                .startsWith("line1  line2 x");
        verify(errorHook, never()).onAdapterError(any());
    }

    @Test
    void sendMessageAcceptsBareChannelRecipients() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, null, List.of("#test"));
        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "conv-1", "#test", "hi", null));

        assertThat(result.success()).isTrue();
        assertThat(server.awaitLineContaining("PRIVMSG #test :hi", WAIT)).isTrue();
    }

    @Test
    void sendMessageWithInvalidRecipientFailsTyped() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, null, List.of("#test"));
        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "conv-1", "user1", "hi", null));

        assertThat(result.success()).isFalse();
        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.UNKNOWN_ERROR);
        assertThat(result.error().message()).contains("Invalid IRC channel format");
        ConnectorAdapterError surfaced = singleSurfacedError();
        assertThat(surfaced.operation()).isEqualTo("sendMessage");
    }

    @Test
    void sendMessageWhileDisconnectedFailsRetryableWithoutSending() {
        when(resolver.resolve()).thenReturn(Optional.empty());

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "conv-1", "irc:#test", "hi", null));

        assertThat(result.success()).isFalse();
        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.NETWORK_ERROR);
        assertThat(result.error().retryable()).isTrue();
        ConnectorAdapterError surfaced = singleSurfacedError();
        assertThat(surfaced.message()).contains("not connected");
    }

    // --- protocol-field injection guard (review-loop P1) ---

    @Test
    void connectWithInjectedPasswordFailsValidationWithoutReachingTheServer() throws Exception {
        server = new MockIrcServer();
        when(resolver.resolve()).thenReturn(Optional.of(new IrcConnectionConfig(
                "127.0.0.1", server.port(), "yaccbot", "s3cret\r\nPRIVMSG #evil :pwned",
                List.of("#test"), 7)));

        assertThatThrownBy(connector::connect)
                .isInstanceOf(ConnectorException.class)
                .satisfies(failure -> assertThat(
                        ((ConnectorException) failure).getError().code())
                        .isEqualTo(ConnectorErrorCode.UNKNOWN_ERROR));

        // Nothing may reach the wire — not the injected command, and not
        // even the registration burst that would follow the bad PASS.
        assertThat(server.receivedLines()).isEmpty();
        assertThat(server.receivedAnyContaining("PRIVMSG #evil")).isFalse();
        ConnectorAdapterError surfaced = singleSurfacedError();
        assertThat(surfaced.message()).contains("IRC validation error");
        // The credential/injected payload must never be echoed.
        assertThat(surfaced.message()).doesNotContain("s3cret").doesNotContain("PRIVMSG");
    }

    @Test
    void connectWithInjectedChannelFailsValidationWithoutReachingTheServer() throws Exception {
        server = new MockIrcServer();
        resolveTo(server, null, List.of("#test\r\nPRIVMSG #evil :x"));

        assertThatThrownBy(connector::connect)
                .isInstanceOf(ConnectorException.class)
                .satisfies(failure -> assertThat(
                        ((ConnectorException) failure).getError().code())
                        .isEqualTo(ConnectorErrorCode.UNKNOWN_ERROR));

        assertThat(server.receivedLines()).isEmpty();
        assertThat(server.receivedAnyContaining("PRIVMSG #evil")).isFalse();
        ConnectorAdapterError surfaced = singleSurfacedError();
        assertThat(surfaced.message()).contains("IRC validation error");
        assertThat(surfaced.message()).doesNotContain("\r").doesNotContain("\n");
    }

    @Test
    void sendMessageWithInjectedRecipientFailsTypedWithoutReachingTheServer() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, null, List.of("#test"));
        connector.connect();
        int linesBefore = server.receivedLines().size();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "conv-1", "irc:#test\r\nPRIVMSG #evil :x", "hi", null));

        assertThat(result.success()).isFalse();
        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.UNKNOWN_ERROR);
        assertThat(result.error().message()).contains("Invalid IRC channel format");
        // The surfaced error must not carry the raw multi-line recipient.
        assertThat(result.error().message()).doesNotContain("\r").doesNotContain("\n");
        assertThat(server.receivedLines()).hasSize(linesBefore);
        assertThat(server.receivedAnyContaining("PRIVMSG #evil")).isFalse();
        verify(errorHook, times(1)).onAdapterError(any());
    }

    // --- inbound seam (baseline message/join/part/quit parity) ---

    @Test
    void inboundPrivmsgReachesTheReceiverNormalized() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, null, List.of("#test"));
        connector.connect();

        server.sendLine(":alice!u@host PRIVMSG #test :hello world");

        long deadline = System.currentTimeMillis() + WAIT.toMillis();
        while (inbound.isEmpty() && System.currentTimeMillis() < deadline) {
            Thread.sleep(10);
        }
        assertThat(inbound).hasSize(1);
        IrcInboundMessage message = inbound.get(0);
        assertThat(message.platform()).isEqualTo("irc");
        assertThat(message.externalThreadId()).isEqualTo("#test");
        assertThat(message.senderExternalUserId()).isEqualTo("alice");
        assertThat(message.senderDisplayName()).isEqualTo("alice");
        assertThat(message.body()).isEqualTo("hello world");
        assertThat(message.correlationId()).isNotNull();
        assertThat(message.rawLine()).contains("PRIVMSG");
        assertThat(connector.health().lastMessageAt()).isNotNull();
        verify(errorHook, never()).onAdapterError(any());
    }

    @Test
    void inboundNoticeReachesTheReceiver() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, null, List.of("#test"));
        connector.connect();

        server.sendLine(":mock.server NOTICE #test :upgrade planned");

        long deadline = System.currentTimeMillis() + WAIT.toMillis();
        while (inbound.isEmpty() && System.currentTimeMillis() < deadline) {
            Thread.sleep(10);
        }
        assertThat(inbound).hasSize(1);
        assertThat(inbound.get(0).body()).isEqualTo("upgrade planned");
    }

    @Test
    void inboundJoinPartQuitAreParsedWithoutReceiverTraffic() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, null, List.of("#test"));
        connector.connect();

        server.sendLine(":bob!u@host JOIN #test");
        server.sendLine(":bob!u@host PART #test");
        server.sendLine(":bob!u@host QUIT :bye");

        // The reader must still be alive after parsing the events (the PONG
        // proves the loop processed past them) and nothing reaches the
        // receiver (baseline logs join/part/quit only).
        server.sendLine("PING :after-events");
        assertThat(server.awaitLineContaining("PONG :after-events", WAIT)).isTrue();
        assertThat(inbound).isEmpty();
    }

    @Test
    void inboundPingIsAnsweredOnTheWire() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        resolveTo(server, null, List.of("#test"));
        connector.connect();

        server.sendLine("PING :t-42");

        assertThat(server.awaitLineContaining("PONG :t-42", WAIT)).isTrue();
    }

    // --- misc parity ---

    @Test
    void capabilitiesReportTheBaselineIrcList() {
        assertThat(connector.capabilities()).containsExactly(
                "send_text", "receive_text", "presence", "typing_indicator");
    }

    @Test
    void sanitizeMessageStripsCrlfAndTruncatesToTheIrcLimit() {
        assertThat(IrcConnector.sanitizeMessage("a\r\nb\nc"))
                .isEqualTo("a  b c");
        assertThat(IrcConnector.sanitizeMessage("x".repeat(500)))
                .hasSize(400);
        assertThat(IrcConnector.sanitizeMessage("short")).isEqualTo("short");
    }

    // --- harness ---

    private ConnectorAdapterError singleSurfacedError() {
        ArgumentCaptor<ConnectorAdapterError> captor =
                ArgumentCaptor.forClass(ConnectorAdapterError.class);
        verify(errorHook, times(1)).onAdapterError(captor.capture());
        return captor.getValue();
    }
}
