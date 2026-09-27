package com.yacc.integration.model;

import java.util.List;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Optional side-effect-free connection-test body (frozen contract op
 * {@code testIrcConnection}; ledger row REST-IRCCONN-003). The request body
 * itself is optional; when present it must satisfy the frozen
 * {@code IrcConfigBody} schema exactly — server/port/username required,
 * password optional, ≥1 channel each '#'-prefixed — enforced by bean
 * validation at the controller boundary ({@code @Valid}; partial bodies are
 * rejected 400 {@code validation_error} before the service runs).
 *
 * @param server   IRC server host
 * @param port     IRC server port (1..65535)
 * @param username IRC nick/user
 * @param password optional server password
 * @param channels '#''-prefixed channel names
 */
public record IrcTestRequest(
        @NotBlank String server,
        @Min(1) @Max(65535) int port,
        @NotBlank String username,
        String password,
        @NotEmpty List<@Pattern(regexp = "^#.*") @Size(min = 2) String> channels) {
}
