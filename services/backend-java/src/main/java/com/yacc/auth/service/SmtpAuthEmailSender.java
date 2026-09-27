package com.yacc.auth.service;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import com.yacc.auth.AuthProperties;

/**
 * SMTP transport for auth emails (MIG-031; {@code spring-boot-starter-mail}).
 * The {@code JavaMailSender} bean binds {@code spring.mail.*} (env/K8s
 * Secret); the From address comes from {@code yacc.auth.email.from} via
 * {@link AuthProperties} (guardrails 004 §4 — typed configuration binding).
 * Selected by {@link AuthEmailConfig} when the configured provider is
 * {@code smtp} (the default).
 */
public class SmtpAuthEmailSender implements AuthEmailSender {

    private final JavaMailSender mailSender;
    private final String from;

    public SmtpAuthEmailSender(JavaMailSender mailSender, AuthProperties properties) {
        this.mailSender = mailSender;
        this.from = properties.email().from();
    }

    @Override
    public void send(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
    }
}
