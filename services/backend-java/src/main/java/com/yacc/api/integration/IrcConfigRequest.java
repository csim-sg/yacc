package com.yacc.api.integration;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * IRC config body (frozen contract component {@code IrcConfigBody};
 * ledger row REST-IRCCONN-001): server/port/username required, password
 * optional, ≥1 channel each '#'-prefixed.
 *
 * @param server IRC server host
 * @param port IRC server port (1..65535)
 * @param username IRC nick/user
 * @param password optional server password
 * @param channels '#''-prefixed channel names
 */
public record IrcConfigRequest(
        @NotBlank String server,
        @Min(1) @Max(65535) int port,
        @NotBlank String username,
        // Contract IrcConfigBody.password: optional, non-nullable — omitted when
        // absent, never null (MIG-102).
        @JsonInclude(JsonInclude.Include.NON_NULL) String password,
        @NotEmpty List<@Pattern(regexp = "^#.*") @Size(min = 2) String> channels) {
}
