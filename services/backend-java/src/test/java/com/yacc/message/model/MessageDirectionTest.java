package com.yacc.message.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class MessageDirectionTest {

    @Test
    void exposesExactPostgresLabelsInEnumOrder() {
        assertThat(Arrays.stream(MessageDirection.values()).map(MessageDirection::getLabel))
                .containsExactly("inbound", "outbound");
    }

    @Test
    void resolvesEveryPostgresLabel() {
        assertThat(MessageDirection.fromLabel("inbound")).isEqualTo(MessageDirection.INBOUND);
        assertThat(MessageDirection.fromLabel("outbound")).isEqualTo(MessageDirection.OUTBOUND);
    }

    @Test
    void rejectsUnknownLabel() {
        assertThatThrownBy(() -> MessageDirection.fromLabel("internal"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("internal");
    }
}
