package com.yacc.api.connector;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.yacc.api.integration.IrcConnectionState;

import jakarta.annotation.PreDestroy;

/**
 * IRC connector runtime (MIG-061; SPEC FR-07) — the Java replacement of the
 * Node {@code irc.connector.ts} behaviors over the MIG-060 platform-generic
 * seam types:
 *
 * <ul>
 *   <li><b>connect</b> — DB-first config resolution
 *       ({@link IrcConnectionConfigResolver}: active profile preferred,
 *       credentials AES-256-GCM at rest), config validation (baseline
 *       {@code validatePlatformConfig} parity), registration + channel
 *       join over {@link IrcProtocolClient}, status lifecycle
 *       {@code connecting → connected | error}.</li>
 *   <li><b>status/reconnect</b> — transitions write into the existing
 *       {@link IrcConnectionState}; baseline 5-attempt cap (EA spec) with
 *       exponential backoff (1s, 2s, 4s, 8s, 16s, capped 60s) and a stable
 *       {@code reconnectIncidentId} per incident.</li>
 *   <li><b>outbound</b> — {@code PRIVMSG} with baseline
 *       {@code sanitizeMessage} parity (CRLF strip + 400-char truncation),
 *       {@code irc:#channel}/{@code #channel} recipient extraction and
 *       {@code irc-<ts>} message-id parity.</li>
 *   <li><b>inbound</b> — normalized {@link IrcInboundMessage}s handed to
 *       the typed {@link IrcMessageReceiver} seam (MIG-062 owns the
 *       connector→conversation/WS bridge).</li>
 *   <li><b>errors</b> — every surfaced adapter failure flows through the
 *       single typed {@link ConnectorAdapterError} path into the
 *       {@link ConnectorErrorHook} seam exactly once (AC-MIG-061-2 hook;
 *       MIG-063 implements DLQ routing + circuit breaker).</li>
 * </ul>
 *
 * <p>The server password exists only in memory for the connection lifetime
 * and is never logged or persisted in plaintext.</p>
 */
@Service
public class IrcConnector {

    private static final Logger log = LoggerFactory.getLogger(IrcConnector.class);

    /** Baseline platform identifier parity. */
    public static final String PLATFORM = "irc";

    /** Baseline EA-spec reconnect cap (exactly 5 attempts). */
    static final int MAX_RECONNECT_ATTEMPTS = 5;

    /** Baseline {@code MAX_MESSAGE_LENGTH = 400} parity (CRLF-stripped). */
    static final int MAX_MESSAGE_LENGTH = 400;

    /** Baseline quit reason parity. */
    private static final String QUIT_MESSAGE = "YACC shutting down";

    /** GPA-003 adapter metadata parity (baseline IRC capabilities list). */
    private static final List<String> CAPABILITIES = List.of(
            "send_text", "receive_text", "presence", "typing_indicator");

    private final IrcConnectionConfigResolver configResolver;
    private final ConnectorErrorHook errorHook;
    private final IrcMessageReceiver receiver;
    private final IrcConnectorProperties properties;
    private final IrcConnectionState connectionState;

    private volatile ConnectorStatus status = ConnectorStatus.DISCONNECTED;
    private volatile IrcProtocolClient client;
    private volatile IrcConnectionConfig config;
    private volatile String lastError;
    private volatile LocalDateTime lastMessageAt;
    private volatile UUID correlationId;
    private volatile boolean manualDisconnect;

    private UUID reconnectIncidentId;
    private int reconnectAttempts;
    private ScheduledFuture<?> pendingReconnect;
    private ScheduledExecutorService scheduler;

    public IrcConnector(IrcConnectionConfigResolver configResolver, ConnectorErrorHook errorHook,
            IrcMessageReceiver receiver, IrcConnectorProperties properties,
            IrcConnectionState connectionState) {
        this.configResolver = configResolver;
        this.errorHook = errorHook;
        this.receiver = receiver;
        this.properties = properties;
        this.connectionState = connectionState;
    }

    /**
     * Connects to IRC: resolves the DB-first config, validates it and
     * performs the registration handshake (optional {@code PASS},
     * {@code NICK}/{@code USER}, wait for {@code 001}) followed by the
     * configured channel joins. Any prior connection is torn down first —
     * a reconnect that cannot produce usable configuration fails closed to
     * a non-connected status with the stale socket discarded.
     *
     * <p>Failures throw typed (already hook-surfaced) and schedule the
     * baseline reconnect cycle (max 5 attempts, exponential backoff, stable
     * incident id).</p>
     *
     * @throws ConnectorException with the typed adapter error when the
     *         config is absent/invalid, the server rejects the registration
     *         or the transport fails
     */
    public synchronized void connect() {
        // Fail closed before resolving: tear down any previous connection so
        // a failed reconnect can never leave a stale usable socket.
        manualDisconnect = false;
        closeClient();
        cancelPendingReconnect();
        status = ConnectorStatus.DISCONNECTED;

        Optional<IrcConnectionConfig> resolved = configResolver.resolve();
        if (resolved.isEmpty()) {
            // Baseline throw-before-the-reconnect-try parity: an unconfigured
            // connector fails without scheduling a reconnect cycle.
            throw failure("connect", ConnectorErrorCode.INVALID_CREDENTIALS,
                    "IRC connection is not configured");
        }
        config = resolved.get();
        correlationId = UUID.randomUUID();
        status = ConnectorStatus.CONNECTING;
        connectionState.markRetrying(reconnectAttempts);
        attemptConnection();
    }

    /**
     * Disconnects: cancels the pending reconnect, sends {@code QUIT}
     * (baseline message parity), closes the socket and resets the reconnect
     * state (baseline manual-disconnect parity). Safe to call repeatedly
     * and from any state.
     */
    public synchronized void disconnect() {
        log.info("Disconnecting from IRC");
        manualDisconnect = true;
        cancelPendingReconnect();
        IrcProtocolClient current = client;
        client = null;
        if (current != null) {
            try {
                current.quit(QUIT_MESSAGE);
            } catch (IOException ignored) {
                // A dead connection must not mask the disconnect itself.
            }
            current.close();
        }
        status = ConnectorStatus.DISCONNECTED;
        reconnectAttempts = 0;
        connectionState.markDisconnected();
    }

    /**
     * Sends one message to an IRC channel as {@code PRIVMSG} (baseline
     * result/error mapping parity). Failures return a typed-failure result
     * (never throw) — each one surfaced through the
     * {@link ConnectorErrorHook} seam first.
     *
     * @param request outbound message ({@code irc:#channel} or
     *                {@code #channel} recipient)
     * @return success (platform message id) or typed failure
     */
    public ConnectorSendResult sendMessage(ConnectorOutboundMessage request) {
        if (status != ConnectorStatus.CONNECTED || client == null) {
            // Baseline parity: sending while not connected is a retryable
            // transport failure (the outbound retry queue owns redelivery).
            return failureResult("sendMessage", ConnectorErrorCode.NETWORK_ERROR,
                    "IRC not connected. Message will be retried via BullMQ.");
        }
        String channel = extractChannel(request.recipientId());
        if (channel == null) {
            // The echoed recipient is sanitized: raw CR/LF must not reach
            // the surfaced error (log forging).
            return failureResult("sendMessage", ConnectorErrorCode.UNKNOWN_ERROR,
                    "Invalid IRC channel format: " + sanitizeMessage(request.recipientId()));
        }
        try {
            client.privmsg(channel, sanitizeMessage(request.body()));
        } catch (IOException transportFailure) {
            // The message never carries credential material, but the
            // exception class name keeps the error path uniform.
            return failureResult("sendMessage", ConnectorErrorCode.NETWORK_ERROR,
                    "IRC send failed: " + transportFailure.getClass().getSimpleName());
        }
        String messageId = "irc-" + System.currentTimeMillis();
        log.info("Message sent to IRC (conversationId={}, channel={}, messageId={})",
                request.conversationId(), channel, messageId);
        return ConnectorSendResult.success(messageId, LocalDateTime.now());
    }

    /** Connection status snapshot (MIG-062 status surface input). */
    public ConnectorStatus status() {
        return status;
    }

    /** Health snapshot (baseline {@code healthCheck} parity). */
    public ConnectorHealth health() {
        boolean healthy = status == ConnectorStatus.CONNECTED;
        return new ConnectorHealth(healthy, healthy ? null : "Status: " + status, lastMessageAt);
    }

    /** GPA-003 adapter metadata parity (baseline IRC capabilities list). */
    public List<String> capabilities() {
        return CAPABILITIES;
    }

    /** The {@code reconnectIncidentId} of the current incident, if any. */
    public synchronized UUID reconnectIncidentId() {
        return reconnectIncidentId;
    }

    // --- connection attempts + reconnect cycle ---

    /**
     * One connection attempt (registration + joins + reader start). Shared
     * by the manual connect and the scheduled retries. On failure: the
     * typed error is surfaced once, the connection is discarded and the
     * reconnect cycle advances, then the typed exception propagates (the
     * scheduled caller swallows it).
     */
    private void attemptConnection() {
        IrcConnectionConfig attemptConfig = config;
        // Baseline parity: config validation happens inside the reconnect-
        // eligible try, so an invalid config also schedules the reconnect
        // cycle (typed UNKNOWN_ERROR, non-retryable).
        String validationError = validate(attemptConfig);
        if (validationError != null) {
            connectFailure(ConnectorErrorCode.UNKNOWN_ERROR,
                    "IRC validation error: " + validationError);
            return;
        }
        IrcProtocolClient created = new IrcProtocolClient(attemptConfig.server(),
                attemptConfig.port(), properties.connectTimeoutMs(), this::onLine,
                this::onConnectionLost);
        client = created;
        try {
            created.register(attemptConfig.nick(), attemptConfig.password(),
                    properties.connectTimeoutMs());
            created.join(attemptConfig.channels());
        } catch (IrcProtocolClient.RegistrationFailedException rejected) {
            connectFailure(rejected.getNumeric().equals("464")
                    ? ConnectorErrorCode.INVALID_CREDENTIALS
                    : ConnectorErrorCode.UNKNOWN_ERROR, rejected.getMessage());
            return;
        } catch (IOException transportFailure) {
            connectFailure(ConnectorErrorCode.NETWORK_ERROR,
                    "IRC connection failed: " + transportFailure.getClass().getSimpleName());
            return;
        }
        // Baseline success parity: reset attempts, report connected, then
        // start relaying inbound traffic. A concurrent manual disconnect
        // wins: the fresh connection is discarded instead of resurrecting a
        // CONNECTED status behind it.
        synchronized (this) {
            if (manualDisconnect) {
                created.close();
                return;
            }
            reconnectAttempts = 0;
            status = ConnectorStatus.CONNECTED;
        }
        connectionState.markConnected();
        created.startReader();
        log.info("Connected to IRC (server={}:{}, nick={}, channels={})",
                attemptConfig.server(), attemptConfig.port(), attemptConfig.nick(),
                attemptConfig.channels());
    }

    private void connectFailure(ConnectorErrorCode code, String message) {
        lastError = message;
        closeClient();
        status = ConnectorStatus.DISCONNECTED;
        ConnectorException failure = failure("connect", code, message);
        scheduleReconnect(message);
        throw failure;
    }

    /** Scheduled retry entry point (baseline {@code setTimeout} parity). */
    private void attemptConnect() {
        synchronized (this) {
            pendingReconnect = null;
            if (manualDisconnect || status == ConnectorStatus.CONNECTED
                    || status == ConnectorStatus.CONNECTING) {
                return;
            }
            status = ConnectorStatus.CONNECTING;
            correlationId = UUID.randomUUID();
        }
        try {
            attemptConnection();
        } catch (ConnectorException failure) {
            // Already surfaced + re-scheduled inside; the scheduler thread
            // must simply survive (baseline scheduled-retry log parity).
            log.warn("IRC reconnect attempt failed: {}", failure.getError().message());
        }
    }

    /**
     * Schedules the next reconnect (baseline {@code scheduleReconnect}
     * parity): duplicate-schedule guard, 5-attempt cap, new incident id
     * exactly when the first retry of an incident is scheduled, exponential
     * backoff, and the {@code retrying}/{attempt} transition into
     * {@link IrcConnectionState}. Terminal exhaustion reports
     * {@code failed} with the attempt count and last error.
     */
    private synchronized void scheduleReconnect(String reason) {
        if (manualDisconnect || pendingReconnect != null) {
            return;
        }
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            log.error("IRC reconnect gave up after {} attempts: {}", reconnectAttempts, reason);
            status = ConnectorStatus.ERROR;
            connectionState.markFailed(reconnectAttempts, reason);
            return;
        }
        if (reconnectAttempts == 0) {
            reconnectIncidentId = UUID.randomUUID();
        }
        reconnectAttempts++;
        long delayMs = IrcConnectorProperties.backoffDelayMs(reconnectAttempts,
                properties.reconnectBaseDelayMs(), properties.reconnectMaxDelayMs());
        connectionState.markRetrying(reconnectAttempts);
        log.info("Scheduling IRC reconnect attempt {}/{} in {}ms (incident {})",
                reconnectAttempts, MAX_RECONNECT_ATTEMPTS, delayMs, reconnectIncidentId);
        pendingReconnect = scheduler().schedule(this::attemptConnect, delayMs,
                TimeUnit.MILLISECONDS);
    }

    /**
     * Socket-loss entry point (baseline socket-close event parity). Stale
     * callbacks from a replaced connection are ignored by identity so a
     * lost connection can never tear down its successor.
     */
    private void onConnectionLost(IrcProtocolClient reportedBy) {
        synchronized (this) {
            if (manualDisconnect || client != reportedBy) {
                return;
            }
            closeClient();
            status = ConnectorStatus.DISCONNECTED;
        }
        log.warn("IRC connection lost");
        scheduleReconnect(lastError != null ? lastError : "connection lost");
    }

    // --- inbound dispatch ---

    private void onLine(IrcLine line) {
        switch (line.command()) {
            case "PRIVMSG", "NOTICE" -> dispatchInbound(line);
            case "JOIN" -> log.debug("IRC user joined channel (nick={}, channel={})",
                    line.nick(), line.firstParam());
            case "PART" -> log.debug("IRC user left channel (nick={}, channel={})",
                    line.nick(), line.firstParam());
            case "QUIT" -> log.debug("IRC user quit (nick={})", line.nick());
            default -> log.debug("Unhandled IRC line (command={})", line.command());
        }
    }

    /**
     * Normalizes one PRIVMSG/NOTICE into {@link IrcInboundMessage} and hands
     * it to the receiver seam. Receiver failures are logged and dropped —
     * baseline ingestion-error parity: they must not break the protocol
     * loop.
     */
    private void dispatchInbound(IrcLine line) {
        String channel = line.firstParam();
        String body = line.trailing();
        if (channel == null || body == null) {
            return;
        }
        String sender = line.nick() == null || line.nick().isBlank()
                ? "unknown"
                : line.nick();
        lastMessageAt = LocalDateTime.now();
        try {
            receiver.onInboundMessage(new IrcInboundMessage(PLATFORM, channel, sender, sender,
                    body, LocalDateTime.now(), UUID.randomUUID(), line.raw()));
        } catch (RuntimeException receiverFailure) {
            log.warn("IRC inbound receiver failed (dropped, baseline ingestion-error parity): {}",
                    receiverFailure.getClass().getSimpleName());
        }
    }

    // --- single typed error path (AC-MIG-061-2) ---

    /**
     * The single typed connector error path: builds the
     * {@link ConnectorAdapterError}, surfaces it to the
     * {@link ConnectorErrorHook} seam exactly once, and wraps it in the
     * connector exception. Every connect-time failure funnels through here.
     */
    private ConnectorException failure(String operation, ConnectorErrorCode code,
            String message) {
        ConnectorAdapterError error = surface(operation, code, message);
        return new ConnectorException(error);
    }

    /**
     * The single typed connector error path for outbound failures: surfaces
     * the typed error to the {@link ConnectorErrorHook} seam, then returns
     * the typed-failure send result (baseline: send failures do not throw).
     */
    private ConnectorSendResult failureResult(String operation, ConnectorErrorCode code,
            String message) {
        ConnectorAdapterError error = surface(operation, code, message);
        return ConnectorSendResult.failure(
                new ConnectorSendResult.SendError(error.code(), error.message(),
                        error.retryable()),
                LocalDateTime.now());
    }

    /** Builds the typed error and invokes the hook (the AC-2 seam call). */
    private ConnectorAdapterError surface(String operation, ConnectorErrorCode code,
            String message) {
        ConnectorAdapterError error = new ConnectorAdapterError(PLATFORM, operation, code,
                message, code.isRetryable(), LocalDateTime.now());
        errorHook.onAdapterError(error);
        return error;
    }

    // --- baseline parity helpers ---

    /**
     * Baseline {@code validatePlatformConfig} parity (server/nick required,
     * port 1..65535 required, at least one {@code #}-prefixed channel) plus
     * the protocol-parameter injection guard (review-loop P1): every field
     * that reaches a protocol line — server, nick, password, channels —
     * must pass {@link IrcProtocolClient#isSafeProtocolParam} (no CR, LF,
     * NUL or spaces), so a stored credential or channel can never inject
     * additional IRC commands during registration/join. The client
     * re-checks the same rule and the single-line property at the write
     * boundary (defense in depth).
     *
     * @return the first validation error message, or null when valid
     */
    private static String validate(IrcConnectionConfig config) {
        if (config.server() == null || config.server().isBlank()) {
            return "Server is required";
        }
        if (!IrcProtocolClient.isSafeProtocolParam(config.server())) {
            return "Server contains characters that are not allowed in a protocol field";
        }
        if (config.nick() == null || config.nick().isBlank()) {
            return "Nick is required";
        }
        if (!IrcProtocolClient.isSafeProtocolParam(config.nick())) {
            return "Nick contains characters that are not allowed in a protocol parameter";
        }
        if (config.port() < 1 || config.port() > 65535) {
            return "Port must be a number between 1 and 65535";
        }
        if (config.channels().isEmpty()) {
            return "At least one channel is required";
        }
        for (String channel : config.channels()) {
            // Safety first, so the baseline format message below never
            // echoes a multi-line value into the surfaced error.
            if (!IrcProtocolClient.isSafeProtocolParam(channel)) {
                return "Channel contains characters that are not allowed in a protocol parameter";
            }
            if (!channel.startsWith("#")) {
                return "Invalid channel format: " + channel + ". Channels must start with #";
            }
        }
        if (config.password() != null && !config.password().isBlank()
                && !IrcProtocolClient.isSafeProtocolParam(config.password())) {
            // Never echo the offending value: it can carry credential
            // material or an injected command payload.
            return "Password contains characters that are not allowed in a protocol parameter";
        }
        return null;
    }

    /**
     * Baseline recipient parity: {@code irc:#channel} or {@code #channel},
     * additionally guarded by {@link IrcProtocolClient#isSafeProtocolParam}
     * so a recipient containing CR/LF/NUL/space is rejected before any
     * {@code PRIVMSG} is composed (command-injection guard).
     *
     * @return the channel, or null when the recipient format is invalid
     */
    private static String extractChannel(String recipientId) {
        if (recipientId == null) {
            return null;
        }
        if (recipientId.startsWith("irc:")) {
            String channel = recipientId.substring("irc:".length());
            return channel.startsWith("#") && IrcProtocolClient.isSafeProtocolParam(channel)
                    ? channel
                    : null;
        }
        return recipientId.startsWith("#") && IrcProtocolClient.isSafeProtocolParam(recipientId)
                ? recipientId
                : null;
    }

    /**
     * Baseline {@code sanitizeMessage} parity: strip CR/LF (injection
     * guard) and truncate to {@link #MAX_MESSAGE_LENGTH}.
     */
    static String sanitizeMessage(String message) {
        String sanitized = message.replaceAll("[\\r\\n]", " ");
        return sanitized.length() > MAX_MESSAGE_LENGTH
                ? sanitized.substring(0, MAX_MESSAGE_LENGTH)
                : sanitized;
    }

    // --- lifecycle ---

    private void closeClient() {
        IrcProtocolClient current = client;
        client = null;
        if (current != null) {
            current.close();
        }
    }

    private void cancelPendingReconnect() {
        ScheduledFuture<?> pending = pendingReconnect;
        pendingReconnect = null;
        if (pending != null) {
            pending.cancel(false);
        }
    }

    private ScheduledExecutorService scheduler() {
        ScheduledExecutorService existing = scheduler;
        if (existing != null) {
            return existing;
        }
        synchronized (this) {
            if (scheduler == null) {
                scheduler = Executors.newSingleThreadScheduledExecutor(runnable -> {
                    Thread thread = new Thread(runnable, "irc-connector-reconnect");
                    thread.setDaemon(true);
                    return thread;
                });
            }
            return scheduler;
        }
    }

    /** Runtime teardown: stops the retry loop and closes the socket. */
    @PreDestroy
    public void shutdown() {
        disconnect();
        ScheduledExecutorService existing = scheduler;
        scheduler = null;
        if (existing != null) {
            existing.shutdownNow();
        }
    }
}
