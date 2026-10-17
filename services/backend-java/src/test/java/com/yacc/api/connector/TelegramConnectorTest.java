package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Telegram connector behavior tests (MIG-060; AC-MIG-060-1/-2) — the HTTP
 * layer is {@link MockRestServiceServer}-bound, so the real Bot API is
 * never contacted (SPEC-002 testing strategy; ARCH-004 §10). Covers the
 * baseline parity surface: connect/{@code getMe} validation + status
 * lifecycle, the outbound {@code sendMessage} request shape with
 * result/error mapping, the inbound update normalization handed to the
 * receiver seam, config (token) validation, and the single typed error
 * path invoking the {@link ConnectorErrorHook} seam (MIG-063 implements
 * DLQ/breaker behind it).
 */
class TelegramConnectorTest {

    /** Matches the baseline token format: 9 digits + ':' + 35 chars. */
    private static final String VALID_TOKEN = "123456789:ABCdefGHIjklMNOpqrSTUvwxy0123456789";

    private static final String BASE_URL = "https://api.telegram.org";

    private static final String GET_ME_OK = """
            {"ok":true,"result":{"id":42,"is_bot":true,
             "first_name":"YaccBot","username":"yacc_bot"}}""";

    private static final String SEND_OK = """
            {"ok":true,"result":{"message_id":777,"from":{"id":42,"is_bot":true},
             "chat":{"id":-100200300,"type":"channel","title":"Ops"},"date":1,
             "text":"hello"}}""";

    private MockRestServiceServer server;
    private TelegramCredentialsResolver credentials;
    private ConnectorErrorHook errorHook;
    private ConnectorStatusListener statusListener;
    private final List<TelegramInboundMessage> inbound = new ArrayList<>();

    private TelegramConnector connector;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        credentials = mock(TelegramCredentialsResolver.class);
        errorHook = mock(ConnectorErrorHook.class);
        statusListener = mock(ConnectorStatusListener.class);
        connector = new TelegramConnector(builder, new TelegramConnectorProperties(null),
                credentials, errorHook, inbound::add, statusListener, new ObjectMapper());
    }

    // --- connect (Bot API getMe) ---

    @Test
    void connectValidatesTheTokenWithGetMeAndReportsConnected() {
        when(credentials.resolve()).thenReturn(Optional.of(
                new TelegramCredentials(VALID_TOKEN, "yacc_bot")));
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/getMe"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(GET_ME_OK, MediaType.APPLICATION_JSON));

        connector.connect();

        assertThat(connector.status()).isEqualTo(ConnectorStatus.CONNECTED);
        assertThat(connector.health().healthy()).isTrue();
        server.verify();
        verify(errorHook, never()).onAdapterError(any());
    }

    /** MIG-062 server-side status surface: transitions fire the additive seam. */
    @Test
    void statusTransitionsFireTheStatusListenerSeam() {
        when(credentials.resolve()).thenReturn(Optional.of(
                new TelegramCredentials(VALID_TOKEN, "yacc_bot")));
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/getMe"))
                .andRespond(withSuccess(GET_ME_OK, MediaType.APPLICATION_JSON));
        connector.connect();
        verify(statusListener).onStatusChange(TelegramConnector.PLATFORM,
                ConnectorStatus.CONNECTED);

        connector.disconnect();
        verify(statusListener).onStatusChange(TelegramConnector.PLATFORM,
                ConnectorStatus.DISCONNECTED);
    }

    @Test
    void connectSurfacesApiRejectionThroughTheTypedErrorPathAndFailsClosed() {
        when(credentials.resolve()).thenReturn(Optional.of(
                new TelegramCredentials(VALID_TOKEN, null)));
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/getMe"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThatThrownBy(connector::connect)
                .isInstanceOf(ConnectorException.class)
                .satisfies(failure -> assertThat(
                        ((ConnectorException) failure).getError().code())
                        .isEqualTo(ConnectorErrorCode.INVALID_CREDENTIALS));
        assertThat(connector.status()).isEqualTo(ConnectorStatus.ERROR);

        ConnectorAdapterError surfaced = captorSingleError();
        assertThat(surfaced.platform()).isEqualTo("telegram");
        assertThat(surfaced.operation()).isEqualTo("connect");
        assertThat(surfaced.code()).isEqualTo(ConnectorErrorCode.INVALID_CREDENTIALS);
        assertThat(surfaced.retryable()).isFalse();
        server.verify();
    }

    @Test
    void connectSurfacesTransportFailureAsRetryableNetworkError() {
        when(credentials.resolve()).thenReturn(Optional.of(
                new TelegramCredentials(VALID_TOKEN, null)));
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/getMe"))
                .andRespond(withException(new SocketTimeoutException("connect timed out")));

        assertThatThrownBy(connector::connect).isInstanceOf(ConnectorException.class);

        ConnectorAdapterError surfaced = captorSingleError();
        assertThat(surfaced.code()).isEqualTo(ConnectorErrorCode.NETWORK_ERROR);
        assertThat(surfaced.retryable()).isTrue();
        assertThat(connector.status()).isEqualTo(ConnectorStatus.ERROR);
        server.verify();
    }

    @Test
    void connectWithoutResolvableCredentialsFailsClosedWithoutCallingTheApi() {
        when(credentials.resolve()).thenReturn(Optional.empty());

        assertThatThrownBy(connector::connect).isInstanceOf(ConnectorException.class);

        ConnectorAdapterError surfaced = captorSingleError();
        assertThat(surfaced.code()).isEqualTo(ConnectorErrorCode.INVALID_CREDENTIALS);
        assertThat(connector.status()).isEqualTo(ConnectorStatus.DISCONNECTED);
        server.verify();
    }

    @Test
    void reconnectAfterCredentialLossFailsClosedAndNeverSendsWithTheStaleToken() {
        expectConnect();
        connector.connect();
        assertThat(connector.status()).isEqualTo(ConnectorStatus.CONNECTED);

        // The DB profile is removed/disabled (or decryption fails) before
        // the next connect: the resolver returns empty and the reconnect
        // must discard the previous connection state.
        when(credentials.resolve()).thenReturn(Optional.empty());
        assertThatThrownBy(connector::connect)
                .isInstanceOf(ConnectorException.class)
                .satisfies(failure -> assertThat(
                        ((ConnectorException) failure).getError().code())
                        .isEqualTo(ConnectorErrorCode.INVALID_CREDENTIALS));

        assertThat(connector.status()).isNotEqualTo(ConnectorStatus.CONNECTED);
        assertThat(connector.status()).isEqualTo(ConnectorStatus.DISCONNECTED);
        assertThat(connector.health().healthy()).isFalse();

        // The stale token must be unusable: sending fails closed without any
        // Bot API call (no sendMessage expectation exists — an unexpected
        // request would fail the mock server, so this asserts no API call).
        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "telegram:12345", "hi", null));

        assertThat(result.success()).isFalse();
        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.NETWORK_ERROR);
        assertThat(result.error().retryable()).isTrue();
        server.verify();
        verify(errorHook, times(2)).onAdapterError(any());
    }

    @Test
    void disconnectResetsTheStatusAndHealth() {
        when(credentials.resolve()).thenReturn(Optional.of(
                new TelegramCredentials(VALID_TOKEN, null)));
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/getMe"))
                .andRespond(withSuccess(GET_ME_OK, MediaType.APPLICATION_JSON));
        connector.connect();

        connector.disconnect();

        assertThat(connector.status()).isEqualTo(ConnectorStatus.DISCONNECTED);
        ConnectorHealth health = connector.health();
        assertThat(health.healthy()).isFalse();
        assertThat(health.details()).isEqualTo("Status: DISCONNECTED");
        assertThat(health.lastMessageAt()).isNull();
    }

    @Test
    void capabilitiesCarryTheBaselineAdapterMetadataParity() {
        assertThat(connector.capabilities()).containsExactly(
                "send_text", "send_attachments", "receive_text", "receive_attachments",
                "delete_message", "update_message", "typing_indicator", "reactions");
    }

    // --- sendMessage (Bot API sendMessage) ---

    @Test
    void sendMessagePostsTheBaselineRequestShapeAndMapsTheResult() {
        expectConnect();
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/sendMessage"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(jsonPath("$.chat_id").value("12345"))
                .andExpect(jsonPath("$.text").value("Deploy finished"))
                .andExpect(jsonPath("$.parse_mode").value("HTML"))
                .andExpect(jsonPath("$.disable_web_page_preview").value(true))
                .andRespond(withSuccess(SEND_OK, MediaType.APPLICATION_JSON));

        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "telegram:12345",
                "Deploy finished", "corr-1"));

        assertThat(result.success()).isTrue();
        assertThat(result.externalMessageId()).isEqualTo("777");
        assertThat(result.error()).isNull();
        assertThat(result.sentAt()).isNotNull();
        server.verify();
        verify(errorHook, never()).onAdapterError(any());
    }

    @Test
    void sendMessageAcceptsBareNumericChatIds() {
        expectConnect();
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/sendMessage"))
                .andExpect(jsonPath("$.chat_id").value("-100200300"))
                .andRespond(withSuccess(SEND_OK, MediaType.APPLICATION_JSON));

        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "-100200300", "hi", null));

        assertThat(result.success()).isTrue();
        server.verify();
    }

    @Test
    void sendMessageMapsUnknownMessageIdsToTheBaselineUnknownLiteral() {
        expectConnect();
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/sendMessage"))
                .andRespond(withSuccess(
                        "{\"ok\":true,\"result\":{}}", MediaType.APPLICATION_JSON));
        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "telegram:12345", "hi", null));

        assertThat(result.success()).isTrue();
        assertThat(result.externalMessageId()).isEqualTo("unknown");
        server.verify();
    }

    @Test
    void sendMessageMapsRateLimitResponsesToRetryableTypedErrors() {
        expectConnect();
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/sendMessage"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"ok\":false,\"error_code\":429,\"description\":"
                                + "\"Too Many Requests: retry after 5\"}"));
        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "telegram:12345", "hi", null));

        assertThat(result.success()).isFalse();
        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.RATE_LIMIT);
        assertThat(result.error().retryable()).isTrue();

        ConnectorAdapterError surfaced = captorSingleError();
        assertThat(surfaced.operation()).isEqualTo("sendMessage");
        assertThat(surfaced.code()).isEqualTo(ConnectorErrorCode.RATE_LIMIT);
        assertThat(surfaced.occurredAt()).isNotNull();
        server.verify();
    }

    @Test
    void sendMessageMapsCredentialRejectionToInvalidCredentials() {
        expectConnect();
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/sendMessage"))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "telegram:12345", "hi", null));

        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.INVALID_CREDENTIALS);
        assertThat(result.error().retryable()).isFalse();
        captorSingleError();
        server.verify();
    }

    @Test
    void sendMessageKeepsTheBaseline400ToMessageTooLongMapping() {
        expectConnect();
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/sendMessage"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST));

        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "telegram:12345", "hi", null));

        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.MESSAGE_TOO_LONG);
        assertThat(result.error().retryable()).isFalse();
        captorSingleError();
        server.verify();
    }

    @Test
    void sendMessageSurfacesAnOkFalseSuccessResponseAsUnknownError() {
        expectConnect();
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/sendMessage"))
                .andRespond(withSuccess(
                        "{\"ok\":false,\"description\":\"conversation not found\"}",
                        MediaType.APPLICATION_JSON));
        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "telegram:12345", "hi", null));

        assertThat(result.success()).isFalse();
        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.UNKNOWN_ERROR);
        assertThat(result.error().message()).contains("conversation not found");
        captorSingleError();
        server.verify();
    }

    @Test
    void sendMessageMapsTransportFailuresToRetryableNetworkErrors() {
        expectConnect();
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/sendMessage"))
                .andRespond(withException(new IOException("connection reset")));

        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "telegram:12345", "hi", null));

        assertThat(result.success()).isFalse();
        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.NETWORK_ERROR);
        assertThat(result.error().retryable()).isTrue();
        captorSingleError();
        server.verify();
    }

    @Test
    void sendMessageWhileDisconnectedFailsClosedAsRetryableNetworkErrorWithoutCallingTheApi() {
        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "telegram:12345", "hi", null));

        assertThat(result.success()).isFalse();
        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.NETWORK_ERROR);
        assertThat(result.error().retryable()).isTrue();
        captorSingleError();
        server.verify();
    }

    @Test
    void sendMessageWithAnInvalidRecipientFormatFailsClosedWithoutCallingTheApi() {
        expectConnect();
        connector.connect();

        ConnectorSendResult result = connector.sendMessage(new ConnectorOutboundMessage(
                "00000000-0000-0000-0000-00000000c001", "irc:#ops", "hi", null));

        assertThat(result.success()).isFalse();
        assertThat(result.error().code()).isEqualTo(ConnectorErrorCode.UNKNOWN_ERROR);
        assertThat(result.error().retryable()).isFalse();
        assertThat(result.error().message()).contains("irc:#ops");
        captorSingleError();
        server.verify();
    }

    // --- inbound intake seam (normalization → typed receiver) ---

    @Test
    void intakeNormalizesTextMessageUpdatesAndHandsThemToTheReceiver() {
        connector.acceptUpdate("""
                {"update_id":1,"message":{"message_id":10,"from":{"id":501,
                 "first_name":"Ada","username":"adaops"},
                 "chat":{"id":-100200300,"type":"group","title":"Ops"},
                 "date":1729161000,"text":"/status now"}}""");

        assertThat(inbound).hasSize(1);
        TelegramInboundMessage message = inbound.get(0);
        assertThat(message.platform()).isEqualTo("telegram");
        assertThat(message.externalThreadId()).isEqualTo("-100200300");
        assertThat(message.senderExternalUserId()).isEqualTo("501");
        assertThat(message.senderDisplayName()).isEqualTo("adaops");
        assertThat(message.body()).isEqualTo("/status now");
        assertThat(message.correlationId()).isNotNull();
        assertThat(message.rawUpdateJson()).contains("update_id\":1");
        assertThat(message.receivedAt())
                .isEqualTo(LocalDateTime.ofInstant(Instant.ofEpochSecond(1729161000),
                        ZoneOffset.UTC));
        ConnectorHealth health = connector.health();
        assertThat(health.lastMessageAt()).isNotNull();
    }

    @Test
    void intakeDisplayNameFallsBackToFirstNameThenUnknown() {
        connector.acceptUpdate(
                "{\"update_id\":2,\"message\":{\"message_id\":11,\"from\":{\"id\":502,"
                        + "\"first_name\":\"Grace\"},\"chat\":{\"id\":77},\"date\":1,"
                        + "\"text\":\"one\"}}");
        connector.acceptUpdate(
                "{\"update_id\":3,\"message\":{\"message_id\":12,\"chat\":{\"id\":77},"
                        + "\"date\":1,\"text\":\"two\"}}");

        assertThat(inbound).hasSize(2);
        assertThat(inbound.get(0).senderDisplayName()).isEqualTo("Grace");
        assertThat(inbound.get(1).senderDisplayName()).isEqualTo("Unknown");
        assertThat(inbound.get(1).senderExternalUserId()).isEqualTo("unknown");
    }

    @Test
    void intakeDropsNonMessageUpdatesAndTextlessMessages() {
        connector.acceptUpdate("{\"update_id\":4,\"my_chat_member\":{\"status\":\"member\"}}");
        connector.acceptUpdate("{\"update_id\":5,\"message\":{\"message_id\":13,"
                + "\"chat\":{\"id\":77},\"date\":1,\"photo\":[{}]}}");

        assertThat(inbound).isEmpty();
        assertThat(connector.health().lastMessageAt()).isNull();
    }

    @Test
    void intakeRejectsMalformedPayloadsAndUndatedTextMessages() {
        assertThatThrownBy(() -> connector.acceptUpdate("{not-json"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> connector.acceptUpdate(
                "{\"update_id\":6,\"message\":{\"message_id\":14,\"chat\":{\"id\":77},"
                        + "\"text\":\"no date\"}}"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(inbound).isEmpty();
    }

    // --- helpers ---

    /** Declares the connect stub (mock server forbids post-request expectations). */
    private void expectConnect() {
        when(credentials.resolve()).thenReturn(Optional.of(
                new TelegramCredentials(VALID_TOKEN, null)));
        server.expect(requestTo(BASE_URL + "/bot" + VALID_TOKEN + "/getMe"))
                .andRespond(withSuccess(GET_ME_OK, MediaType.APPLICATION_JSON));
    }

    private ConnectorAdapterError captorSingleError() {
        ArgumentCaptor<ConnectorAdapterError> captor =
                ArgumentCaptor.forClass(ConnectorAdapterError.class);
        verify(errorHook).onAdapterError(captor.capture());
        return captor.getValue();
    }
}
