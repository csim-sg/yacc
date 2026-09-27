package com.yacc.message.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class MessageStatusTest {

    @Test
    void exposesExactPostgresLabelsInEnumOrder() {
        assertThat(Arrays.stream(MessageStatus.values()).map(MessageStatus::getLabel))
                .containsExactly("pending", "sent", "failed");
    }

    @Test
    void resolvesEveryPostgresLabel() {
        assertThat(MessageStatus.fromLabel("pending")).isEqualTo(MessageStatus.PENDING);
        assertThat(MessageStatus.fromLabel("sent")).isEqualTo(MessageStatus.SENT);
        assertThat(MessageStatus.fromLabel("failed")).isEqualTo(MessageStatus.FAILED);
    }

    @Test
    void rejectsUnknownLabel() {
        assertThatThrownBy(() -> MessageStatus.fromLabel("queued"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("queued");
    }
}
