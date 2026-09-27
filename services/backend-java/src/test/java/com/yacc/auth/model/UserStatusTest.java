package com.yacc.auth.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class UserStatusTest {

    @Test
    void exposesExactPostgresLabelsInEnumOrder() {
        assertThat(Arrays.stream(UserStatus.values()).map(UserStatus::getLabel))
                .containsExactly("active", "inactive", "suspended");
    }

    @Test
    void resolvesEveryPostgresLabel() {
        assertThat(UserStatus.fromLabel("active")).isEqualTo(UserStatus.ACTIVE);
        assertThat(UserStatus.fromLabel("inactive")).isEqualTo(UserStatus.INACTIVE);
        assertThat(UserStatus.fromLabel("suspended")).isEqualTo(UserStatus.SUSPENDED);
    }

    @Test
    void rejectsUnknownLabel() {
        assertThatThrownBy(() -> UserStatus.fromLabel("archived"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("archived");
    }
}
