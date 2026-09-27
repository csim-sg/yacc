package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import com.yacc.auth.AuthProperties;

/**
 * Unit tests for the SMTP transport adapter (MIG-031). The
 * {@code JavaMailSender} is a Mockito mock — no real SMTP server is ever
 * contacted (AbstractPostgresIntegrationTest test conventions).
 */
@ExtendWith(MockitoExtension.class)
class SmtpAuthEmailSenderTest {

    @Mock
    private JavaMailSender mailSender;

    @Captor
    private ArgumentCaptor<SimpleMailMessage> messageCaptor;

    private SmtpAuthEmailSender sender;

    @BeforeEach
    void setUp() {
        sender = new SmtpAuthEmailSender(mailSender, new AuthProperties(null, null, null,
                new AuthProperties.Email("no-reply@fixture.yacc.local", "smtp", null,
                        null, 0, null), null, null, null));
    }

    @Test
    void sendsAFromToSubjectTextMessage() {
        sender.send("user@fixture.yacc.local", "Subject", "Body text");

        verify(mailSender).send(messageCaptor.capture());
        SimpleMailMessage mail = messageCaptor.getValue();
        assertThat(mail.getFrom()).isEqualTo("no-reply@fixture.yacc.local");
        assertThat(mail.getTo()).isEqualTo(new String[] {"user@fixture.yacc.local"});
        assertThat(mail.getSubject()).isEqualTo("Subject");
        assertThat(mail.getText()).isEqualTo("Body text");
        assertThat(sender).isInstanceOf(AuthEmailSender.class);
    }
}
