package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.entity.ChannelType;
import com.yacc.entity.Conversation;
import com.yacc.entity.DeadLetterQueueEntry;
import com.yacc.entity.Message;
import com.yacc.entity.MessageDirection;
import com.yacc.entity.MessageStatus;
import com.yacc.repository.ConversationRepository;
import com.yacc.repository.MessageRepository;
import com.yacc.service.DlqService;

/**
 * MIG-063 connector-error surface against the real PostgreSQL data layer
 * (AC-MIG-063-1 cross-feature half): surfaced adapter errors open the
 * platform breaker at the frozen threshold of five, and the DLQ entry
 * surface is fail-closed over the frozen FKs — real message/conversation
 * identities create the row (7-day retention, POC {@code moveToDLQ}
 * parity), context-free identities are rejected by the schema.
 */
@Transactional
class ConnectorErrorSurfaceIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private DlqService dlq;
    @Autowired
    private ConversationRepository conversations;
    @Autowired
    private MessageRepository messages;

    @Test
    void surfacedConnectorErrorsOpenThePlatformBreakerAtFive() {
        ConnectorCircuitBreaker breaker = new ConnectorCircuitBreaker();
        ConnectorBreakerErrorHook hook = new ConnectorBreakerErrorHook(breaker);

        for (int failure = 0; failure < 4; failure++) {
            hook.onAdapterError(new ConnectorAdapterError("telegram", "sendMessage",
                    ConnectorErrorCode.NETWORK_ERROR, "connect timed out", true,
                    LocalDateTime.now()));
        }
        assertThat(breaker.isOpen("telegram")).isFalse();

        hook.onAdapterError(new ConnectorAdapterError("telegram", "sendMessage",
                ConnectorErrorCode.NETWORK_ERROR, "connect timed out", true,
                LocalDateTime.now()));

        assertThat(breaker.isOpen("telegram")).isTrue();
        assertThat(breaker.failureCount("telegram")).isEqualTo(5);
    }

    @Test
    void dlqEntryCreationRequiresRealMessageAndConversationIdentities() {
        UUID phantomMessageId = UUID.randomUUID();

        assertThatThrownBy(() -> dlq.enqueue(phantomMessageId, UUID.randomUUID(),
                "{\"origin\":\"mig-063\"}", "platform_error", 1, "boom", null, null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void dlqEntryLifecycleMoveWithRealIdentitiesFollowsThePocRetention() {
        Conversation conversation = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, "telegram:42"));
        UUID messageId = UUID.randomUUID();
        Message message = messages.save(new Message(messageId, conversation.getId(), null,
                "yacc", "body", MessageDirection.OUTBOUND));
        message.setStatus(MessageStatus.FAILED);
        messages.save(message);

        DeadLetterQueueEntry entry = dlq.enqueue(messageId, conversation.getId(),
                "{\"origin\":\"mig-063\"}", "platform_error", 1, "send failed", null,
                "{\"platform\":\"telegram\"}");

        var reloaded = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(reloaded.getId()).isEqualTo(entry.getId());
        assertThat(reloaded.getFailureReason()).isEqualTo("platform_error");
        assertThat(reloaded.getTotalAttempts()).isEqualTo(1);
        assertThat(reloaded.getRetryAttempt()).isNull();
        assertThat(reloaded.getExpiresAt()).isAfter(LocalDateTime.now().plusDays(6));
        assertThat(dlq.isRetryCycleExhausted(reloaded)).isFalse();
        assertThat(dlq.retryCycleAttempt(reloaded)).isZero();
    }
}
