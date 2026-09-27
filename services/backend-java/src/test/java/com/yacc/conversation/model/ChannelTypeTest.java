package com.yacc.conversation.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Arrays;
import org.junit.jupiter.api.Test;

class ChannelTypeTest {

    @Test
    void exposesExactPostgresLabelsInEnumOrder() {
        assertThat(Arrays.stream(ChannelType.values()).map(ChannelType::getLabel))
                .containsExactly("telegram", "irc", "whatsapp", "wechat", "meta", "x", "email", "slack");
    }

    @Test
    void resolvesEveryPostgresLabel() {
        assertThat(ChannelType.fromLabel("telegram")).isEqualTo(ChannelType.TELEGRAM);
        assertThat(ChannelType.fromLabel("irc")).isEqualTo(ChannelType.IRC);
        assertThat(ChannelType.fromLabel("whatsapp")).isEqualTo(ChannelType.WHATSAPP);
        assertThat(ChannelType.fromLabel("wechat")).isEqualTo(ChannelType.WECHAT);
        assertThat(ChannelType.fromLabel("meta")).isEqualTo(ChannelType.META);
        assertThat(ChannelType.fromLabel("x")).isEqualTo(ChannelType.X);
        assertThat(ChannelType.fromLabel("email")).isEqualTo(ChannelType.EMAIL);
        assertThat(ChannelType.fromLabel("slack")).isEqualTo(ChannelType.SLACK);
    }

    @Test
    void rejectsUnknownLabel() {
        assertThatThrownBy(() -> ChannelType.fromLabel("sms"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sms");
    }
}
