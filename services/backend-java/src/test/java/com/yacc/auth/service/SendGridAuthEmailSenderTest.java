package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import com.yacc.auth.AuthProperties;

/**
 * Unit tests for the SendGrid transport adapter (MIG-031). The HTTP layer
 * is {@link MockRestServiceServer}-bound — no real SendGrid call is ever
 * made. The API key arrives only from configuration and travels solely in
 * the Authorization header.
 */
class SendGridAuthEmailSenderTest {

    private static final String API_KEY = "SG.test-key-fixture";

    private MockRestServiceServer server;

    private SendGridAuthEmailSender sender;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        sender = new SendGridAuthEmailSender(builder, new AuthProperties(null, null, null,
                new AuthProperties.Email("no-reply@fixture.yacc.local", "sendgrid",
                        API_KEY, null, 0, null),
                null, null));
    }

    @Test
    void postsTheSendGridV3MailPayload() {
        server.expect(ExpectedCount.once(),
                        requestTo("https://api.sendgrid.com/v3/mail/send"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer " + API_KEY))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.personalizations[0].to[0].email")
                        .value("user@fixture.yacc.local"))
                .andExpect(jsonPath("$.from.email").value("no-reply@fixture.yacc.local"))
                .andExpect(jsonPath("$.subject").value("Subject"))
                .andExpect(jsonPath("$.content[0].value").value("Body text"))
                .andRespond(withStatus(HttpStatus.ACCEPTED));

        sender.send("user@fixture.yacc.local", "Subject", "Body text");

        server.verify();
    }

    @Test
    void transportFailurePropagatesToTheRetryLayer() {
        server.expect(ExpectedCount.once(),
                        requestTo("https://api.sendgrid.com/v3/mail/send"))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        assertThatThrownBy(() ->
                sender.send("user@fixture.yacc.local", "Subject", "Body text"))
                .isInstanceOf(Exception.class);
        server.verify();
    }
}
