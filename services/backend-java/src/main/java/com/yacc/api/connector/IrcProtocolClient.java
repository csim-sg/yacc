package com.yacc.api.connector;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.Closeable;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.function.Consumer;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Minimal IRC protocol client over a plain {@link java.net.Socket} (MIG-061
 * pinned tech-lead routing: <b>no new Gradle dependency</b>, precedent
 * {@code IrcConfigService}'s connection test). The frozen contract surface
 * ({@code IrcConfigBody}: server/port/username/password?/channels) bounds
 * the required protocol subset:
 *
 * <ul>
 *   <li>plain TCP connect with a hard timeout,</li>
 *   <li>optional {@code PASS} + {@code NICK}/{@code USER} registration,
 *       waiting for {@code 001} (RPL_WELCOME — baseline {@code registered}
 *       event parity), answering {@code PING} while registering,</li>
 *   <li>{@code JOIN} for configured channels (after registration),</li>
 *   <li>outbound {@code PRIVMSG},</li>
 *   <li>inbound {@code PRIVMSG}/{@code NOTICE}/{@code JOIN}/{@code PART}/
 *       {@code QUIT} handed to the line consumer,</li>
 *   <li>{@code PING}/{@code PONG} keep-alive: server pings are answered
 *       immediately, and a client {@code PING} goes out after ~60s of
 *       silence (baseline {@code ping_interval: 60} parity).</li>
 * </ul>
 *
 * <p>Instances are per-connection (baseline {@code IRCClient} parity):
 * created by {@link IrcConnector} per attempt, never a Spring bean. The
 * reader runs on one daemon thread; writes are serialized. TLS/SASL/IRCv3
 * are deliberately absent — the frozen config carries no such field
 * (bounded subset; escalation stop: route back to tech-lead if parity
 * provably needs more).</p>
 */
public class IrcProtocolClient implements Closeable {

    private static final Logger log = LoggerFactory.getLogger(IrcProtocolClient.class);

    /** Reader poll tick: keep-alive/liveness granularity (1s). */
    private static final int READ_TICK_MS = 1_000;

    /** Client PING after ~60s of silence (baseline ping_interval parity). */
    private static final int PING_AFTER_IDLE_TICKS = 60;

    private final String host;
    private final int port;
    private final int connectTimeoutMs;
    private final Consumer<IrcLine> inboundLine;
    private final Consumer<IrcProtocolClient> connectionLost;

    private Socket socket;
    private BufferedReader reader;
    private BufferedWriter writer;
    private volatile boolean closed;
    private Thread readerThread;

    /**
     * Creates an unconnected client.
     *
     * @param inboundLine     consumer for every inbound line after
     *                        registration (PING is answered internally and
     *                        never surfaced)
     * @param connectionLost  invoked once with this client when the
     *                        connection drops without {@link #close()} (EOF
     *                        or I/O failure) — lets the owner ignore stale
     *                        callbacks from a replaced connection
     */
    public IrcProtocolClient(String host, int port, int connectTimeoutMs,
            Consumer<IrcLine> inboundLine, Consumer<IrcProtocolClient> connectionLost) {
        this.host = host;
        this.port = port;
        this.connectTimeoutMs = connectTimeoutMs;
        this.inboundLine = inboundLine;
        this.connectionLost = connectionLost;
    }

    /**
     * Opens the TCP connection, sends the optional {@code PASS} plus
     * {@code NICK}/{@code USER} and blocks until the server accepts
     * registration ({@code 001}) or the deadline passes. Server {@code PING}
     * challenges during registration are answered inline.
     *
     * @param nick                  registration nick
     * @param password              optional server password (null/blank
     *                              sends no {@code PASS})
     * @param registrationTimeoutMs overall deadline in milliseconds
     * @throws RegistrationFailedException when the server rejects the
     *         registration (carries the IRC numeric, e.g. {@code 464}
     *         password mismatch, {@code 433} nick in use)
     * @throws IOException on transport failure, server-side close during
     *         registration, or deadline expiry
     */
    public void register(String nick, String password, int registrationTimeoutMs)
            throws IOException {
        connectSocket();
        if (password != null && !password.isBlank()) {
            sendLine("PASS " + password);
        }
        sendLine("NICK " + nick);
        sendLine("USER " + nick + " 0 * :" + nick);
        awaitRegistered(nick, registrationTimeoutMs);
    }

    /** Joins the given channels (baseline: after registration only). */
    public void join(Collection<String> channels) throws IOException {
        for (String channel : channels) {
            sendLine("JOIN " + channel);
        }
    }

    /** Sends one sanitized chat message (baseline {@code say} parity). */
    public void privmsg(String target, String text) throws IOException {
        sendLine("PRIVMSG " + target + " :" + text);
    }

    /** Sends {@code QUIT} (baseline disconnect message parity). */
    public void quit(String message) throws IOException {
        sendLine("QUIT :" + message);
    }

    /**
     * Starts the daemon reader loop (after successful registration): parses
     * every line, answers {@code PING}, surfaces everything else to the
     * consumer, and reports the lost connection exactly once.
     */
    public synchronized void startReader() {
        if (closed || readerThread != null) {
            return;
        }
        readerThread = new Thread(this::readLoop, "irc-connector-reader");
        readerThread.setDaemon(true);
        readerThread.start();
    }

    /** {@code true} while the client has an open socket. */
    public boolean isOpen() {
        return !closed && socket != null && socket.isConnected() && !socket.isClosed();
    }

    @Override
    public void close() {
        closed = true;
        closeSocketQuietly();
    }

    // --- connection lifecycle ---

    private void connectSocket() throws IOException {
        Socket created = new Socket();
        created.connect(new InetSocketAddress(host, port), connectTimeoutMs);
        created.setTcpNoDelay(true);
        this.socket = created;
        this.reader = new BufferedReader(
                new InputStreamReader(created.getInputStream(), StandardCharsets.UTF_8));
        this.writer = new BufferedWriter(
                new OutputStreamWriter(created.getOutputStream(), StandardCharsets.UTF_8));
    }

    private void awaitRegistered(String nick, int registrationTimeoutMs) throws IOException {
        long deadlineNanos = System.nanoTime() + registrationTimeoutMs * 1_000_000L;
        while (true) {
            long remainingMs = (deadlineNanos - System.nanoTime()) / 1_000_000;
            if (remainingMs <= 0) {
                throw new IOException(
                        "Connection timeout: did not receive registered event");
            }
            socket.setSoTimeout((int) Math.min(remainingMs, Integer.MAX_VALUE));
            String raw = readLine();
            if (raw == null) {
                throw new IOException("Connection closed by server");
            }
            IrcLine line = IrcLine.parse(raw);
            switch (line.command()) {
                case "001" -> {
                    return;
                }
                case "PING" -> sendLine("PONG :" + orEmpty(line.trailing()));
                case "464" -> throw new RegistrationFailedException("464",
                        "IRC registration rejected: password incorrect (464)");
                case "433" -> throw new RegistrationFailedException("433",
                        "IRC registration rejected: nickname is already in use (433)");
                default -> {
                    // Other numerics (MOTD etc.) are not registration
                    // failures — keep waiting for 001 (bounded subset).
                }
            }
        }
    }

    private void readLoop() {
        boolean lost = false;
        try {
            socket.setSoTimeout(READ_TICK_MS);
            int idleTicks = 0;
            while (!closed) {
                String raw;
                try {
                    raw = reader.readLine();
                } catch (SocketTimeoutException tick) {
                    idleTicks++;
                    if (idleTicks >= PING_AFTER_IDLE_TICKS) {
                        sendLine("PING :yacc-keepalive");
                        idleTicks = 0;
                    }
                    continue;
                }
                idleTicks = 0;
                if (raw == null) {
                    log.debug("IRC connection closed by server");
                    lost = true;
                    return;
                }
                IrcLine line = IrcLine.parse(raw);
                if ("PING".equals(line.command())) {
                    sendLine("PONG :" + orEmpty(line.trailing()));
                    continue;
                }
                inboundLine.accept(line);
            }
        } catch (IOException failure) {
            if (!closed) {
                log.debug("IRC reader loop failed: {}", failure.getClass().getSimpleName());
                lost = true;
            }
        } catch (RuntimeException consumerFailure) {
            // A consumer crash must not leave a zombie connection: treat it
            // as a lost connection so the reconnect flow takes over.
            if (!closed) {
                log.warn("IRC reader loop consumer failed: {}",
                        consumerFailure.getClass().getSimpleName());
                lost = true;
            }
        } finally {
            if (lost && !closed) {
                connectionLost.accept(this);
            }
        }
    }

    /** One serialized protocol write (reader PONGs and sends share it). */
    private synchronized void sendLine(String line) throws IOException {
        if (closed || writer == null) {
            throw new IOException("IRC connection is not open");
        }
        writer.write(line + "\r\n");
        writer.flush();
    }

    private String readLine() throws IOException {
        try {
            return reader.readLine();
        } catch (SocketTimeoutException timeout) {
            return ""; // deadline tick — the caller re-checks the budget
        }
    }

    private void closeSocketQuietly() {
        try {
            if (socket != null) {
                socket.close();
            }
        } catch (IOException ignored) {
            // Closing a broken socket is best-effort.
        }
    }

    private static String orEmpty(String value) {
        return value == null ? "" : value;
    }

    /**
     * Server-side registration rejection (carries the IRC numeric so the
     * connector maps it to the typed error path: {@code 464} →
     * {@code INVALID_CREDENTIALS}, others → {@code UNKNOWN_ERROR}).
     */
    public static final class RegistrationFailedException extends IOException {

        private static final long serialVersionUID = 1L;

        private final String numeric;

        public RegistrationFailedException(String numeric, String message) {
            super(message);
            this.numeric = numeric;
        }

        /** IRC error numeric (e.g. {@code "464"}). */
        public String getNumeric() {
            return numeric;
        }
    }
}
