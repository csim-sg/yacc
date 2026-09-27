package com.yacc.conversation.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class ConversationPriorityTest {

    @Test
    void exposesExactPostgresLabelsInEnumOrder() {
        // Final POC enum: 'medium' was renamed to 'normal' by 0002_fix_priority_enum.
        assertThat(Arrays.stream(ConversationPriority.values()).map(ConversationPriority::getLabel))
                .containsExactly("low", "normal", "high", "urgent");
    }

    @Test
    void resolvesEveryPostgresLabel() {
        assertThat(ConversationPriority.fromLabel("low")).isEqualTo(ConversationPriority.LOW);
        assertThat(ConversationPriority.fromLabel("normal")).isEqualTo(ConversationPriority.NORMAL);
        assertThat(ConversationPriority.fromLabel("high")).isEqualTo(ConversationPriority.HIGH);
        assertThat(ConversationPriority.fromLabel("urgent")).isEqualTo(ConversationPriority.URGENT);
    }

    @Test
    void rejectsUnknownLabel() {
        assertThatThrownBy(() -> ConversationPriority.fromLabel("medium"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("medium");
    }
}
