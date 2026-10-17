package com.yacc.api.connector;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * In-test mock IRC server (guardrail 13: never contact a real IRC network —
 * SPEC-002 testing strategy; ARCH-004 §10). Accepts loopback TCP
 * connections, records every received protocol line in order, and writes
 * scripted lines back. Sequentially accepts replacement connections so
 * reconnect attempts reuse the same fixture.
 */
final class MockIrcServer implements Closeable {

    private final ServerSocket serverSocket;
    private final List<String> received = new CopyOnWriteArrayList<>();
    private final List<String[]> scriptedResponses = new CopyOnWriteArrayList<>();
    private volatile Socket connection;
    private volatile BufferedWriter out;
    private volatile boolean closed;
    private volatile boolean autoRegisterEnabled;
    private final Thread acceptThread;

    MockIrcServer() throws IOException {
        serverSocket = new ServerSocket(0, 8, InetAddress.getLoopbackAddress());
        acceptThread = new Thread(this::acceptLoop, "mock-irc-server");
        acceptThread.setDaemon(true);
        acceptThread.start();
    }

    /**
     * Replies {@code 001} automatically as soon as the client sends NICK —
     * lets tests call the blocking {@code register()} directly.
     */
    void autoRegister() {
        autoRegisterEnabled = true;
    }

    /**
     * Scripts one server response: when a received line starts with
     * {@code requestPrefix}, {@code responseLine} is written back (from the
     * server thread — lets synchronous {@code connect()} calls observe
     * server-driven behavior like numeric rejections).
     */
    void scriptResponse(String requestPrefix, String responseLine) {
        scriptedResponses.add(new String[] {requestPrefix, responseLine});
    }

    /** Ephemeral loopback port the connector must point at. */
    int port() {
        return serverSocket.getLocalPort();
    }

    /** Every line the client sent, in arrival order. */
    List<String> receivedLines() {
        return List.copyOf(received);
    }

    /** {@code true} when some received line contains the fragment. */
    boolean receivedAnyContaining(String fragment) {
        return received.stream().anyMatch(line -> line.contains(fragment));
    }

    /** Writes one raw protocol line to the connected client. */
    void sendLine(String line) throws IOException {
        BufferedWriter writer = out;
        if (writer == null) {
            throw new IOException("mock IRC server has no connected client");
        }
        synchronized (writer) {
            writer.write(line + "\r\n");
            writer.flush();
        }
    }

    /** Drops the current client connection (connection-loss simulation). */
    void dropClient() {
        Socket current = connection;
        connection = null;
        out = null;
        if (current != null) {
            try {
                current.close();
            } catch (IOException ignored) {
                // Best-effort teardown.
            }
        }
    }

    /**
     * Waits until some received line contains the fragment.
     *
     * @return {@code true} when seen within the timeout
     */
    boolean awaitLineContaining(String fragment, Duration timeout) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeout.toMillis();
        while (System.currentTimeMillis() < deadline) {
            if (receivedAnyContaining(fragment)) {
                return true;
            }
            Thread.sleep(10);
        }
        return receivedAnyContaining(fragment);
    }

    /** Completes one registration burst: waits for NICK, replies 001. */
    void completeRegistration() throws IOException, InterruptedException {
        if (!awaitLineContaining("NICK ", Duration.ofSeconds(5))) {
            throw new AssertionError("client never sent NICK");
        }
        String nick = receivedLines().stream()
                .filter(line -> line.startsWith("NICK "))
                .findFirst()
                .orElseThrow()
                .substring("NICK ".length());
        sendLine(":mock.server 001 " + nick + " :Welcome to the mock IRC server");
    }

    /**
     * Waits until at least {@code expected} received lines start with the
     * fragment (for counting repeated client lines, e.g. reconnect
     * registrations).
     */
    boolean awaitLineCount(String linePrefix, int expected, Duration timeout)
            throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeout.toMillis();
        while (System.currentTimeMillis() < deadline) {
            if (countLinesStartingWith(linePrefix) >= expected) {
                return true;
            }
            Thread.sleep(10);
        }
        return countLinesStartingWith(linePrefix) >= expected;
    }

    /** Waits until the client joined a channel the given number of times. */
    boolean awaitJoinCount(int expected, Duration timeout) throws InterruptedException {
        return awaitLineCount("JOIN #", expected, timeout);
    }

    long countLinesStartingWith(String prefix) {
        return received.stream().filter(line -> line.startsWith(prefix)).count();
    }

    @Override
    public void close() {
        closed = true;
        dropClient();
        try {
            serverSocket.close();
        } catch (IOException ignored) {
            // Best-effort teardown.
        }
    }

    private void acceptLoop() {
        while (!closed) {
            try {
                Socket socket = serverSocket.accept();
                dropClient();
                connection = socket;
                serve(socket);
            } catch (IOException acceptFailure) {
                if (!closed) {
                    // Transient accept failure — keep serving.
                }
            }
        }
    }

    private void serve(Socket socket) {
        try (BufferedReader in = new BufferedReader(
                new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))) {
            BufferedWriter writer = new BufferedWriter(
                    new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8));
            this.out = writer;
            String line;
            while (!closed && (line = in.readLine()) != null) {
                received.add(line);
                for (String[] script : scriptedResponses) {
                    if (line.startsWith(script[0])) {
                        synchronized (writer) {
                            writer.write(script[1] + "\r\n");
                            writer.flush();
                        }
                    }
                }
                if (autoRegisterEnabled && line.startsWith("NICK ")) {
                    String nick = line.substring("NICK ".length());
                    synchronized (writer) {
                        writer.write(":mock.server 001 " + nick + " :Welcome to the mock IRC server\r\n");
                        writer.flush();
                    }
                }
            }
        } catch (IOException readFailure) {
            // Client gone (drop/close) — the accept loop takes the next one.
        } finally {
            if (connection == socket) {
                out = null;
            }
        }
    }
}
