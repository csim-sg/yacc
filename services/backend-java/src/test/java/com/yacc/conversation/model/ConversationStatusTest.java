package com.yacc.conversation.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class ConversationStatusTest {

    @Test
    void exposesExactPostgresLabelsInEnumOrder() {
        assertThat(Arrays.stream(ConversationStatus.values()).map(ConversationStatus::getLabel))
                .containsExactly("open", "pending", "resolved");
    }

    @Test
    void resolvesEveryPostgresLabel() {
        assertThat(ConversationStatus.fromLabel("open")).isEqualTo(ConversationStatus.OPEN);
        assertThat(ConversationStatus.fromLabel("pending")).isEqualTo(ConversationStatus.PENDING);
        assertThat(ConversationStatus.fromLabel("resolved")).isEqualTo(ConversationStatus.RESOLVED);
    }

    @Test
    void rejectsUnknownLabel() {
        assertThatThrownBy(() -> ConversationStatus.fromLabel("closed"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("closed");
    }
}
