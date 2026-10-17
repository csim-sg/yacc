package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * Minimal socket IRC client tests (MIG-061) — protocol behavior against the
 * in-test {@link MockIrcServer} (guardrail 13: never a real IRC network).
 * Covers the pinned bounded subset: PASS/NICK/USER registration waiting for
 * {@code 001}, PING/PONG keep-alive (registration + reader loop), typed
 * registration rejection (464/433), deadline expiry, server-side close,
 * the protocol-field injection guard (review-loop P1: CR/LF/NUL/space in
 * password/nick/channel/recipient never reaches the wire), and bounded
 * inbound framing (review-loop P2: oversized/unterminated lines drop the
 * connection without unbounded allocation).
 */
class IrcProtocolClientTest {

    private static final Duration WAIT = Duration.ofSeconds(5);

    private MockIrcServer server;
    private IrcProtocolClient client;

    @AfterEach
    void tearDown() {
        if (client != null) {
            client.close();
        }
        if (server != null) {
            server.close();
        }
    }

    @Test
    void registrationSendsPassNickUserAndCompletesOnWelcome() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        client = newClient();
        client.register("yaccbot", "s3cret", 2_000);

        assertThat(server.awaitLineContaining("USER yaccbot 0 * :yaccbot", WAIT)).isTrue();
        List<String> lines = server.receivedLines();
        assertThat(lines).containsSubsequence("PASS s3cret", "NICK yaccbot",
                "USER yaccbot 0 * :yaccbot");
        assertThat(client.isOpen()).isTrue();
    }

    @Test
    void registrationWithoutPasswordSendsNoPassLine() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        client = newClient();
        client.register("yaccbot", null, 2_000);

        assertThat(server.awaitLineContaining("USER yaccbot", WAIT)).isTrue();
        assertThat(server.receivedLines())
                .contains("NICK yaccbot", "USER yaccbot 0 * :yaccbot")
                .noneMatch(line -> line.startsWith("PASS"));
    }

    @Test
    void pingDuringRegistrationIsAnsweredInline() throws Exception {
        server = new MockIrcServer();
        client = newClient();
        Thread register = new Thread(() -> {
            try {
                client.register("yaccbot", null, 2_000);
            } catch (IOException ignored) {
                // Test asserts the PONG, not the registration outcome.
            }
        });
        register.setDaemon(true);
        register.start();

        assertThat(server.awaitLineContaining("NICK yaccbot", WAIT)).isTrue();
        server.sendLine("PING :reg-check");
        assertThat(server.awaitLineContaining("PONG :reg-check", WAIT)).isTrue();

        server.sendLine(":mock.server 001 yaccbot :Welcome");
        register.join(5_000);
        assertThat(client.isOpen()).isTrue();
    }

    @Test
    void passwordMismatchRejectsWithTheIrcNumeric() throws Exception {
        server = new MockIrcServer();
        client = newClient();
        Thread register = registerAsync();

        assertThat(server.awaitLineContaining("NICK yaccbot", WAIT)).isTrue();
        server.sendLine(":mock.server 464 yaccbot :Password incorrect");

        register.join(5_000);
        assertThat(registrationFailures).hasSize(1);
        assertThat(registrationFailures.get(0))
                .isInstanceOf(IrcProtocolClient.RegistrationFailedException.class)
                .hasMessageContaining("464");
        assertThat(((IrcProtocolClient.RegistrationFailedException)
                registrationFailures.get(0)).getNumeric()).isEqualTo("464");
    }

    @Test
    void nicknameInUseRejectsWithTheIrcNumeric() throws Exception {
        server = new MockIrcServer();
        client = newClient();
        Thread register = registerAsync();

        assertThat(server.awaitLineContaining("NICK yaccbot", WAIT)).isTrue();
        server.sendLine(":mock.server 433 yaccbot :Nickname is already in use");

        register.join(5_000);
        assertThat(registrationFailures).hasSize(1);
        assertThat(((IrcProtocolClient.RegistrationFailedException)
                registrationFailures.get(0)).getNumeric()).isEqualTo("433");
    }

    @Test
    void silentServerExpiresTheRegistrationDeadline() throws Exception {
        server = new MockIrcServer();
        client = newClient();
        long startedAt = System.nanoTime();

        assertThatThrownBy(() -> client.register("yaccbot", null, 250))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("timeout");

        long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000;
        assertThat(elapsedMs).isBetween(200L, 5_000L);
    }

    @Test
    void serverCloseDuringRegistrationFailsTheHandshake() throws Exception {
        server = new MockIrcServer();
        client = newClient();
        Thread register = registerAsync();

        assertThat(server.awaitLineContaining("NICK yaccbot", WAIT)).isTrue();
        server.dropClient();

        register.join(5_000);
        assertThat(registrationFailures).hasSize(1);
        assertThat((Exception) registrationFailures.get(0))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("closed by server");
    }

    @Test
    void readerLoopAnswersServerPingsAndRelaysInboundLines() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        client = newClient();
        client.register("yaccbot", null, 2_000);
        client.startReader();

        server.sendLine("PING :keepalive-1");
        assertThat(server.awaitLineContaining("PONG :keepalive-1", WAIT)).isTrue();

        server.sendLine(":alice!u@host PRIVMSG #test :hello there");
        assertThat(awaitInboundContaining("PRIVMSG", WAIT)).isTrue();
    }

    @Test
    void joinsChannelsAfterRegistration() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        client = newClient();
        client.register("yaccbot", null, 2_000);

        client.join(List.of("#test", "#ops"));

        assertThat(server.awaitLineContaining("JOIN #test", WAIT)).isTrue();
        assertThat(server.awaitLineContaining("JOIN #ops", WAIT)).isTrue();
    }

    @Test
    void closeIsIdempotentAndSendsAreRejectedAfterwards() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        client = newClient();
        client.register("yaccbot", null, 2_000);

        client.close();
        client.close();
        assertThat(client.isOpen()).isFalse();
        assertThatThrownBy(() -> client.privmsg("#test", "hi"))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("not open");
    }

    // --- P1: protocol-field injection guard (review loop 1) ---

    @Test
    void protocolParamSafetyRejectsCrLfNulAndSpaces() {
        assertThat(IrcProtocolClient.isSafeProtocolParam("yaccbot")).isTrue();
        assertThat(IrcProtocolClient.isSafeProtocolParam("#a-b_c^012")).isTrue();

        assertThat(IrcProtocolClient.isSafeProtocolParam(null)).isFalse();
        assertThat(IrcProtocolClient.isSafeProtocolParam("")).isFalse();
        assertThat(IrcProtocolClient.isSafeProtocolParam("a b")).isFalse();
        assertThat(IrcProtocolClient.isSafeProtocolParam("a\rb")).isFalse();
        assertThat(IrcProtocolClient.isSafeProtocolParam("a\nb")).isFalse();
        assertThat(IrcProtocolClient.isSafeProtocolParam("a\r\nb")).isFalse();
        assertThat(IrcProtocolClient.isSafeProtocolParam("a\0b")).isFalse();
    }

    @Test
    void registrationWithInjectedPasswordNeverReachesTheServer() throws Exception {
        server = new MockIrcServer();
        client = newClient();

        // A stored PASS carrying CRLF must fail before anything is written:
        // no PASS, no NICK/USER, and no injected PRIVMSG.
        assertThatThrownBy(() -> client.register("yaccbot",
                "s3cret\r\nPRIVMSG #evil :pwned", 2_000))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("password");

        assertThat(server.receivedLines()).isEmpty();
        assertThat(server.receivedAnyContaining("PRIVMSG #evil")).isFalse();
    }

    @Test
    void registrationWithInjectedNickNeverReachesTheServer() throws Exception {
        server = new MockIrcServer();
        client = newClient();

        assertThatThrownBy(() -> client.register("yaccbot\r\nPRIVMSG #evil :x",
                null, 2_000))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("nick");

        assertThat(server.receivedLines()).isEmpty();
        assertThat(server.receivedAnyContaining("PRIVMSG #evil")).isFalse();
    }

    @Test
    void joinWithInjectedChannelNeverReachesTheServer() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        client = newClient();
        client.register("yaccbot", null, 2_000);
        int linesBefore = server.receivedLines().size();

        assertThatThrownBy(() -> client.join(List.of("#test\r\nPRIVMSG #evil :x")))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("channel");

        assertThat(server.receivedLines()).hasSize(linesBefore);
        assertThat(server.receivedAnyContaining("PRIVMSG #evil")).isFalse();
    }

    @Test
    void privmsgWithInjectedTargetNeverReachesTheServer() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        client = newClient();
        client.register("yaccbot", null, 2_000);
        int linesBefore = server.receivedLines().size();

        assertThatThrownBy(() -> client.privmsg("#test\r\nPRIVMSG #evil :x", "hi"))
                .isInstanceOf(IOException.class);

        assertThat(server.receivedLines()).hasSize(linesBefore);
        assertThat(server.receivedAnyContaining("PRIVMSG #evil")).isFalse();
    }

    // --- P2: bounded inbound framing (review loop 1) ---

    @Test
    void oversizedUnterminatedInboundLineDropsTheConnection() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        client = newClient();
        client.register("yaccbot", null, 2_000);
        client.startReader();

        // Beyond the 512-octet budget with no terminator: the reader must
        // report the connection lost instead of buffering without bound.
        server.sendRaw("x".repeat(600));

        long deadline = System.currentTimeMillis() + WAIT.toMillis();
        while (lostConnections.isEmpty() && System.currentTimeMillis() < deadline) {
            Thread.sleep(10);
        }
        assertThat(lostConnections).containsExactly(client);
        // Nothing from the violating line may surface as inbound traffic.
        assertThat(inbound).isEmpty();
    }

    @Test
    void lineWithinTheOctetBudgetIsDeliveredAndTheLoopSurvives() throws Exception {
        server = new MockIrcServer();
        server.autoRegister();
        client = newClient();
        client.register("yaccbot", null, 2_000);
        client.startReader();

        server.sendRaw("x".repeat(500) + "\r\n");

        long deadline = System.currentTimeMillis() + WAIT.toMillis();
        while (inbound.isEmpty() && System.currentTimeMillis() < deadline) {
            Thread.sleep(10);
        }
        assertThat(inbound).hasSize(1);
        assertThat(inbound.get(0).raw()).hasSize(500);
        assertThat(lostConnections).isEmpty();

        // The reader loop must still be healthy after the long line.
        server.sendLine("PING :after-long-line");
        assertThat(server.awaitLineContaining("PONG :after-long-line", WAIT)).isTrue();
    }

    @Test
    void oversizedInboundLineDuringRegistrationFailsWithAFramingViolation() throws Exception {
        server = new MockIrcServer();
        client = newClient();
        Thread register = registerAsync();

        assertThat(server.awaitLineContaining("NICK yaccbot", WAIT)).isTrue();
        server.sendRaw("x".repeat(600));

        register.join(5_000);
        assertThat(registrationFailures).hasSize(1);
        // A framing violation fails fast — it must not be a timeout.
        assertThat((Exception) registrationFailures.get(0))
                .isInstanceOf(IOException.class)
                .hasMessageContaining("octet");
    }

    // --- harness ---

    private final List<Exception> registrationFailures = new CopyOnWriteArrayList<>();
    private final List<IrcLine> inbound = new CopyOnWriteArrayList<>();
    private final List<IrcProtocolClient> lostConnections = new CopyOnWriteArrayList<>();

    private IrcProtocolClient newClient() {
        return new IrcProtocolClient("127.0.0.1", server.port(), 2_000,
                inbound::add, lostConnections::add);
    }

    private Thread registerAsync() {
        Thread register = new Thread(() -> {
            try {
                client.register("yaccbot", null, 2_000);
            } catch (IOException failure) {
                registrationFailures.add(failure);
            }
        });
        register.setDaemon(true);
        register.start();
        return register;
    }

    private boolean awaitInboundContaining(String fragment, Duration timeout)
            throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeout.toMillis();
        while (System.currentTimeMillis() < deadline) {
            if (inbound.stream().anyMatch(line -> line.raw().contains(fragment))) {
                return true;
            }
            Thread.sleep(10);
        }
        return false;
    }
}
