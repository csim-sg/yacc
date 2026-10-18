package com.yacc.api.connector;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Telegram connector (MIG-060; SPEC FR-07) — Bot API inbound/outbound
 * messaging parity over the POC {@code telegram.connector.ts} +
 * {@code telegram.adapter.ts} behaviors:
 *
 * <ul>
 *   <li><b>connect</b> — DB-first credential resolution
 *       ({@link TelegramCredentialsResolver}, AES-256-GCM at rest) validated
 *       with a Bot API {@code getMe} call (baseline token validation +
 *       status lifecycle: {@code connecting → connected | error}).</li>
 *   <li><b>outbound</b> — {@code sendMessage} with the baseline request
 *       shape ({@code chat_id}, {@code text}, {@code parse_mode=HTML},
 *       {@code disable_web_page_preview=true}), {@code telegram:chatId}
 *       recipient extraction, and typed result/error mapping.</li>
 *   <li><b>inbound</b> — the connector-owned injectable intake seam: a Bot
 *       API update payload normalizes (baseline {@code processUpdate}
 *       parity) and hands to the typed {@link TelegramUpdateReceiver}.
 *       Deliberately <b>no HTTP webhook route</b> — the frozen
 *       {@code openapi.yaml} has no Telegram path and GOV-038 locks the
 *       surface. The WS bridge ops/rooms are MIG-062 scope.</li>
 *   <li><b>errors</b> — every adapter failure flows through the single
 *       typed {@link ConnectorAdapterError} path into the
 *       {@link ConnectorErrorHook} seam (AC-MIG-060-2 hook; MIG-063
 *       implements DLQ routing + circuit breaker).</li>
 * </ul>
 *
 * <p>The bot token exists only in memory for the connection lifetime and is
 * never logged or persisted in plaintext.</p>
 */
@Service
public class TelegramConnector implements PlatformConnector {

    private static final Logger log = LoggerFactory.getLogger(TelegramConnector.class);

    /** Baseline platform identifier parity. */
    public static final String PLATFORM = "telegram";

    /** GPA-003 adapter metadata parity (baseline capabilities list). */
    private static final List<String> CAPABILITIES = List.of(
            "send_text", "send_attachments", "receive_text", "receive_attachments",
            "delete_message", "update_message", "typing_indicator", "reactions");

    private final RestClient restClient;
    private final TelegramConnectorProperties properties;
    private final TelegramCredentialsResolver credentials;
    private final ConnectorErrorHook errorHook;
    private final TelegramUpdateReceiver receiver;
    private final ConnectorStatusListener statusListener;
    private final ObjectMapper mapper;

    private volatile ConnectorStatus status = ConnectorStatus.DISCONNECTED;
    private volatile String botToken;
    private volatile LocalDateTime lastMessageAt;

    public TelegramConnector(RestClient.Builder restClientBuilder,
            TelegramConnectorProperties properties, TelegramCredentialsResolver credentials,
            ConnectorErrorHook errorHook, TelegramUpdateReceiver receiver,
            ConnectorStatusListener statusListener, ObjectMapper mapper) {
        this.restClient = restClientBuilder.build();
        this.properties = properties;
        this.credentials = credentials;
        this.errorHook = errorHook;
        this.receiver = receiver;
        this.statusListener = statusListener;
        this.mapper = mapper;
    }

    /**
     * Connects to Telegram: resolves the DB-first bot token, validates its
     * format (baseline {@code isValidTelegramToken} parity) and verifies it
     * with a Bot API {@code getMe} call. Any prior connection state is
     * reset first — a reconnect that cannot produce usable credentials
     * (profile removed/disabled, decryption failure, malformed token) or a
     * Bot API rejection fails closed to a non-connected status with the
     * stale in-memory token discarded, so {@code sendMessage} can never
     * send with a revoked/removed credential.
     *
     * @throws ConnectorException with the typed adapter error (already
     *         surfaced to the {@link ConnectorErrorHook}) when credentials
     *         are absent/malformed or the Bot API rejects/ times out
     */
    public void connect() {
        // Fail closed before resolving credentials: discard any previous
        // connection state so a failed reconnect can never leave the old
        // token usable or the connector reporting CONNECTED.
        botToken = null;
        status = ConnectorStatus.DISCONNECTED;
        Optional<TelegramCredentials> resolved = credentials.resolve();
        if (resolved.isEmpty()) {
            throw failure("connect", ConnectorErrorCode.INVALID_CREDENTIALS,
                    "Telegram bot token is not configured");
        }
        TelegramCredentials resolvedCredentials = resolved.get();
        if (!TelegramCredentials.isValidTokenFormat(resolvedCredentials.botToken())) {
            throw failure("connect", ConnectorErrorCode.INVALID_CREDENTIALS,
                    "Invalid Telegram bot token format");
        }
        status = ConnectorStatus.CONNECTING;
        TelegramApiEnvelope response = callBotApi(resolvedCredentials.botToken(), "getMe", Map.of());
        if (!response.ok()) {
            status = ConnectorStatus.ERROR;
            statusListener.onStatusChange(PLATFORM, ConnectorStatus.ERROR);
            throw failure("connect", response.failureCode(),
                    responseDescription(response, "Telegram API error"));
        }
        this.botToken = resolvedCredentials.botToken();
        status = ConnectorStatus.CONNECTED;
        // MIG-062 server-side status surface: the connected transition emits
        // the frozen raw status channels and resets the platform breaker
        // (the G6 un-wedge path).
        statusListener.onStatusChange(PLATFORM, ConnectorStatus.CONNECTED);
        log.info("Connected to Telegram{} (getMe ok)",
                resolvedCredentials.botName() == null ? "" : " as " + resolvedCredentials.botName());
    }

    /** Disconnects (status reset; the in-memory token is discarded). */
    public void disconnect() {
        log.info("Disconnecting from Telegram");
        status = ConnectorStatus.DISCONNECTED;
        botToken = null;
        statusListener.onStatusChange(PLATFORM, ConnectorStatus.DISCONNECTED);
    }

    /**
     * Sends a message through the Bot API {@code sendMessage} method
     * (baseline request shape and result/error mapping parity). Failures
     * return a typed-failure result (never throw) — each one surfaced
     * through the {@link ConnectorErrorHook} seam first.
     *
     * @param request outbound message ({@code telegram:chatId} or bare
     *                numeric chat id recipient)
     * @return success (platform message id) or typed failure
     */
    public ConnectorSendResult sendMessage(ConnectorOutboundMessage request) {
        if (status != ConnectorStatus.CONNECTED || botToken == null) {
            // Baseline parity: sending while not connected is a retryable
            // transport failure.
            return failureResult("sendMessage", ConnectorErrorCode.NETWORK_ERROR,
                    "Telegram not connected");
        }
        String chatId = extractChatId(request.recipientId());
        if (chatId == null) {
            return failureResult("sendMessage", ConnectorErrorCode.UNKNOWN_ERROR,
                    "Invalid Telegram recipient format: " + request.recipientId());
        }
        TelegramApiEnvelope response = callBotApi(botToken, "sendMessage", Map.of(
                "chat_id", chatId,
                "text", request.body(),
                "parse_mode", "HTML",
                "disable_web_page_preview", true));
        if (!response.ok()) {
            return failureResult("sendMessage", response.failureCode(),
                    responseDescription(response, "Telegram API error"));
        }
        String messageId = extractMessageId(response.result());
        log.info("Message sent to Telegram (conversationId={}, chatId={}, messageId={})",
                request.conversationId(), chatId, messageId);
        return ConnectorSendResult.success(messageId, LocalDateTime.now());
    }

    /**
     * Intake seam: accepts one raw Bot API update payload, normalizes it
     * (baseline {@code processUpdate} parity) and hands it to the
     * {@link TelegramUpdateReceiver}. Updates without a {@code message}
     * object or without text are dropped (baseline parity).
     *
     * @param updateJson raw Bot API update JSON
     * @throws IllegalArgumentException when the payload is not valid JSON or
     *         a text message lacks {@code date} (caller contract violation —
     *         fail-closed; not a hook-surfaced adapter error)
     */
    public void acceptUpdate(String updateJson) {
        JsonNode update = parseUpdate(updateJson);
        JsonNode message = update.path("message");
        if (message.isMissingNode() || message.isNull()) {
            return;
        }
        String text = message.path("text").asText(null);
        if (text == null || text.isEmpty()) {
            return;
        }
        JsonNode date = message.path("date");
        if (!date.canConvertToLong()) {
            throw new IllegalArgumentException(
                    "Telegram update text message carries no date field");
        }
        JsonNode sender = message.path("from");
        lastMessageAt = LocalDateTime.now();
        receiver.onInboundMessage(new TelegramInboundMessage(
                PLATFORM,
                message.path("chat").path("id").asText(),
                sender.path("id").asText("unknown"),
                displayName(sender),
                text,
                LocalDateTime.ofInstant(Instant.ofEpochSecond(date.asLong()), ZoneOffset.UTC),
                UUID.randomUUID(),
                updateJson));
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

    /** GPA-003 adapter metadata parity (baseline capabilities list). */
    public List<String> capabilities() {
        return CAPABILITIES;
    }

    // --- single typed error path (AC-MIG-060-2) ---

    /**
     * The single typed connector error path: builds the
     * {@link ConnectorAdapterError}, surfaces it to the
     * {@link ConnectorErrorHook} seam exactly once, and wraps it in the
     * connector exception. Every connect-time failure funnels through here.
     */
    private ConnectorException failure(String operation, ConnectorErrorCode code, String message) {
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
                new ConnectorSendResult.SendError(error.code(), error.message(), error.retryable()),
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

    // --- Bot API transport ---

    /**
     * Calls one Bot API method. Non-2xx responses map to an {@code ok:false}
     * envelope with the HTTP status as {@code error_code} (baseline
     * {@code callTelegramApi} parity); transport failures map to an
     * {@code ok:false} envelope without a status code.
     */
    private TelegramApiEnvelope callBotApi(String token, String method, Map<String, Object> params) {
        // The URL embeds the bot token — this string is never logged.
        String url = properties.baseUrl() + "/bot" + token + "/" + method;
        try {
            return restClient.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(params)
                    .exchange((request, response) -> {
                        if (response.getStatusCode().is2xxSuccessful()) {
                            return TelegramApiEnvelope.of(mapper.readTree(response.getBody()));
                        }
                        String body = new String(response.getBody().readAllBytes(),
                                StandardCharsets.UTF_8);
                        return TelegramApiEnvelope.httpError(response.getStatusCode().value(),
                                body);
                    });
        } catch (UncheckedIOException | RestClientException failure) {
            // Transport failure parity: no HTTP status → NETWORK_ERROR at the
            // mapping layer. The exception message can carry the URI — strip
            // it so the token can never reach the error path or the logs.
            return TelegramApiEnvelope.transportFailure(
                    "Telegram API call failed: " + failure.getClass().getSimpleName());
        }
    }

    /**
     * Baseline error-code mapping parity ({@code mapErrorCode}): 429 →
     * {@code RATE_LIMIT}; 401/403 → {@code INVALID_CREDENTIALS}; 400 →
     * {@code MESSAGE_TOO_LONG} (baseline approximation of the Bot API's
     * generic 400); anything else → {@code UNKNOWN_ERROR}.
     */
    private static ConnectorErrorCode mapErrorCode(int errorCode) {
        return switch (errorCode) {
            case 429 -> ConnectorErrorCode.RATE_LIMIT;
            case 401, 403 -> ConnectorErrorCode.INVALID_CREDENTIALS;
            case 400 -> ConnectorErrorCode.MESSAGE_TOO_LONG;
            default -> ConnectorErrorCode.UNKNOWN_ERROR;
        };
    }

    private static String responseDescription(TelegramApiEnvelope response, String fallback) {
        return response.description() == null || response.description().isBlank()
                ? fallback
                : response.description();
    }

    /** Baseline recipient parity: {@code telegram:chatId} or bare numeric. */
    private static String extractChatId(String recipientId) {
        if (recipientId == null) {
            return null;
        }
        if (recipientId.startsWith("telegram:")) {
            return recipientId.substring("telegram:".length());
        }
        if (recipientId.matches("-?\\d+")) {
            return recipientId;
        }
        return null;
    }

    /** Baseline message-id extraction parity: missing → {@code "unknown"}. */
    private static String extractMessageId(JsonNode result) {
        JsonNode messageId = result == null ? null : result.path("message_id");
        if (messageId == null || messageId.isMissingNode() || messageId.isNull()) {
            return "unknown";
        }
        return messageId.asText("unknown");
    }

    /** Baseline displayName precedence: username → first name → "Unknown". */
    private static String displayName(JsonNode sender) {
        String username = sender.path("username").asText(null);
        if (username != null && !username.isEmpty()) {
            return username;
        }
        String firstName = sender.path("first_name").asText(null);
        if (firstName != null && !firstName.isEmpty()) {
            return firstName;
        }
        return "Unknown";
    }

    private JsonNode parseUpdate(String updateJson) {
        try {
            return mapper.readTree(updateJson);
        } catch (IOException failure) {
            throw new IllegalArgumentException("Malformed Telegram update payload", failure);
        }
    }

    /**
     * Internal Bot API response envelope ({@code {ok, result, description,
     * error_code}} parity). {@code result} stays a parsed tree — the
     * envelope is an external-API passthrough, never a wire DTO. A failed
     * envelope carries its mapped {@link ConnectorErrorCode} so transport
     * failures ({@code NETWORK_ERROR}) stay distinguishable from
     * unclassified API failures ({@code UNKNOWN_ERROR}).
     */
    private record TelegramApiEnvelope(boolean ok, JsonNode result, String description,
            ConnectorErrorCode failureCode) {

        static TelegramApiEnvelope of(JsonNode body) {
            boolean ok = body.path("ok").asBoolean(false);
            return new TelegramApiEnvelope(
                    ok,
                    body.path("result"),
                    body.path("description").asText(null),
                    ok ? null : ConnectorErrorCode.UNKNOWN_ERROR);
        }

        static TelegramApiEnvelope httpError(int status, String body) {
            return new TelegramApiEnvelope(false, null, "HTTP " + status + ": " + body,
                    mapErrorCode(status));
        }

        static TelegramApiEnvelope transportFailure(String message) {
            return new TelegramApiEnvelope(false, null, message,
                    ConnectorErrorCode.NETWORK_ERROR);
        }
    }
}
