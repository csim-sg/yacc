package com.yacc.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.client.RestClient.Builder;

import com.yacc.auth.service.AuthEmailSender;
import com.yacc.auth.service.SendGridAuthEmailSender;
import com.yacc.auth.service.SmtpAuthEmailSender;

/**
 * Auth-email provider wiring (MIG-031; guardrails 004 §4 — singleton
 * transport clients via {@code @Configuration}+{@code @Bean}, provider
 * selected by typed configuration). The configured
 * {@code yacc.auth.email.provider} picks the {@link AuthEmailSender}
 * adapter: {@code smtp} (default) or {@code sendgrid}.
 */
@Configuration
public class AuthEmailConfig {

    /**
     * Selects the configured auth-email transport.
     *
     * @param properties  auth configuration (provider + secret material)
     * @param mailSender  SMTP transport (spring-boot-starter-mail)
     * @param restClientBuilder HTTP client builder for the SendGrid adapter
     * @return the active {@link AuthEmailSender}
     * @throws IllegalStateException when the provider name is unknown or the
     *         SendGrid API key is missing (fail-closed)
     */
    @Bean
    public AuthEmailSender authEmailSender(AuthProperties properties,
            JavaMailSender mailSender, Builder restClientBuilder) {
        AuthProperties.Email email = properties.email();
        return switch (email.provider()) {
            case AuthProperties.Email.PROVIDER_SMTP ->
                new SmtpAuthEmailSender(mailSender, properties);
            case AuthProperties.Email.PROVIDER_SENDGRID -> {
                if (email.sendGridApiKey() == null || email.sendGridApiKey().isBlank()) {
                    throw new IllegalStateException(
                            "yacc.auth.email.provider=sendgrid requires"
                                    + " YACC_AUTH_EMAIL_SENDGRID_API_KEY (fail-closed)");
                }
                yield new SendGridAuthEmailSender(restClientBuilder, properties);
            }
            default -> throw new IllegalStateException(
                    "Unknown yacc.auth.email.provider '" + email.provider()
                            + "' — expected 'smtp' or 'sendgrid'");
        };
    }
}
