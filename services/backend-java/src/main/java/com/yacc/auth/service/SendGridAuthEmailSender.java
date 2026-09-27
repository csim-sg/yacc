package com.yacc.auth.service;

import org.springframework.web.client.RestClient;

import com.yacc.auth.AuthProperties;

/**
 * SendGrid transport for auth emails (MIG-031; SPEC-002 integration table).
 * Posts the v3 mail/send JSON payload with the API key from
 * {@code yacc.auth.email.send-grid-api-key} (env/K8s Secret — never logged,
 * never defaulted). Transport failures propagate to {@link AuthEmailService}
 * for retry + audit. Selected by {@link AuthEmailConfig} when the configured
 * provider is {@code sendgrid}.
 */
public class SendGridAuthEmailSender implements AuthEmailSender {

    private static final String SEND_GRID_URI = "https://api.sendgrid.com/v3/mail/send";

    private final RestClient restClient;
    private final String apiKey;
    private final String from;

    public SendGridAuthEmailSender(RestClient.Builder restClientBuilder,
            AuthProperties properties) {
        this.restClient = restClientBuilder.build();
        this.apiKey = properties.email().sendGridApiKey();
        this.from = properties.email().from();
    }

    @Override
    public void send(String to, String subject, String body) {
        restClient.post()
                .uri(SEND_GRID_URI)
                .header("Authorization", "Bearer " + apiKey)
                .body(new SendGridMail(from, to, subject, body))
                .retrieve()
                .toBodilessEntity();
    }

    /**
     * SendGrid v3 mail/send request shape — only the fields this service
     * uses (single recipient, plain text).
     *
     * @param from    sender envelope
     * @param to      recipient envelope list
     * @param subject subject line
     * @param content plain-text content list
     */
    record SendGridMail(Address from, Personalization[] personalizations,
            String subject, Content[] content) {

        SendGridMail(String fromAddress, String toAddress, String subject, String text) {
            this(new Address(fromAddress),
                    new Personalization[] {new Personalization(toAddress)},
                    subject,
                    new Content[] {new Content(text)});
        }

        /**
         * @param email one address
         */
        record Address(String email) {
        }

        /**
         * @param to recipient list
         */
        record Personalization(Address[] to) {

            Personalization(String toAddress) {
                this(new Address[] {new Address(toAddress)});
            }
        }

        /**
         * @param type content MIME type (always text/plain here)
         * @param value body text
         */
        record Content(String type, String value) {

            Content(String text) {
                this("text/plain", text);
            }
        }
    }
}
