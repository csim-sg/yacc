package com.yacc.auth.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class UserRoleTest {

    @Test
    void exposesExactPostgresLabelsInEnumOrder() {
        assertThat(Arrays.stream(UserRole.values()).map(UserRole::getLabel))
                .containsExactly("super_admin", "admin", "manager", "user");
    }

    @Test
    void resolvesEveryPostgresLabel() {
        assertThat(UserRole.fromLabel("super_admin")).isEqualTo(UserRole.SUPER_ADMIN);
        assertThat(UserRole.fromLabel("admin")).isEqualTo(UserRole.ADMIN);
        assertThat(UserRole.fromLabel("manager")).isEqualTo(UserRole.MANAGER);
        assertThat(UserRole.fromLabel("user")).isEqualTo(UserRole.USER);
    }

    @Test
    void rejectsUnknownLabel() {
        assertThatThrownBy(() -> UserRole.fromLabel("root"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("root");
    }
}
