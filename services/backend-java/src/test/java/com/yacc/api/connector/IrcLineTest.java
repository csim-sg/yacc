package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

/**
 * IRC protocol line parser tests (MIG-061) — the minimal RFC 1459 §2.3.1
 * subset the pinned no-dependency client needs: prefix, command, middle
 * params, trailing.
 */
class IrcLineTest {

    @Test
    void parsesPrefixedPrivmsgWithTrailing() {
        IrcLine line = IrcLine.parse(":alice!u@host PRIVMSG #test :hello world\r\n");

        assertThat(line.prefix()).isEqualTo("alice!u@host");
        assertThat(line.nick()).isEqualTo("alice");
        assertThat(line.command()).isEqualTo("PRIVMSG");
        assertThat(line.params()).containsExactly("#test");
        assertThat(line.firstParam()).isEqualTo("#test");
        assertThat(line.trailing()).isEqualTo("hello world");
    }

    @Test
    void parsesPrefixlessPing() {
        IrcLine line = IrcLine.parse("PING :tok123");

        assertThat(line.prefix()).isNull();
        assertThat(line.nick()).isNull();
        assertThat(line.command()).isEqualTo("PING");
        assertThat(line.trailing()).isEqualTo("tok123");
    }

    @Test
    void parsesWelcomeNumeric() {
        IrcLine line = IrcLine.parse(":server 001 yaccbot :Welcome to IRC");

        assertThat(line.nick()).isEqualTo("server");
        assertThat(line.command()).isEqualTo("001");
        assertThat(line.params()).containsExactly("yaccbot");
        assertThat(line.trailing()).isEqualTo("Welcome to IRC");
    }

    @Test
    void parsesMultipleMiddleParamsAndLowercasesCommand() {
        IrcLine line = IrcLine.parse(":n!u@h join #a #b");

        assertThat(line.command()).isEqualTo("JOIN");
        assertThat(line.params()).containsExactly("#a", "#b");
        assertThat(line.trailing()).isNull();
    }

    @Test
    void parsesBareNickPrefixAndEmptyTrailing() {
        IrcLine line = IrcLine.parse(":alice QUIT :");

        assertThat(line.nick()).isEqualTo("alice");
        assertThat(line.command()).isEqualTo("QUIT");
        assertThat(line.trailing()).isEmpty();
    }

    @Test
    void blankLinesParseToAnEmptySkippableCommand() {
        IrcLine line = IrcLine.parse("\r\n");

        assertThat(line.command()).isEmpty();
        assertThat(line.params()).isEqualTo(List.of());
    }
}
