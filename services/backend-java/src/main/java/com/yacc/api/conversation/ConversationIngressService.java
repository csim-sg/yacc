package com.yacc.api.conversation;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.api.audit.AuditRecord;
import com.yacc.entity.ChannelType;
import com.yacc.entity.Conversation;
import com.yacc.entity.ConversationPriority;
import com.yacc.entity.ConversationStatus;
import com.yacc.repository.ConversationRepository;
import com.yacc.service.AuditPersistence;

/**
 * Public ingress API of the {@code conversation} bounded context for the
 * connector inbound flow (MIG-062 D2; guardrails G9/G10 — the exchange
 * composes through this owning-module service API, never through a
 * repository import; ARCH-004 §1/§14 rule 1).
 *
 * <p>Baseline parity source: the POC {@code gateway-exchange}
 * {@code upsertConversation} + {@code conversationService.createMessage}
 * conversation-side behavior:</p>
 *
 * <ul>
 *   <li><b>find-or-create</b> keyed on {@code (channel, externalThreadId)}
 *       plus {@code ircProfileId} when the inbound event carries one
 *       (guardrail G12; the POC omitted the profile condition when its event
 *       carried none); creation parity is {@code title = externalThreadId},
 *       {@code status = open}, {@code priority = normal} and
 *       {@code metadata.source = <platform>_adapter};</li>
 *   <li><b>auto-reopen</b> — an inbound message on a {@code resolved}
 *       conversation reopens it to {@code open} with the baseline
 *       {@code conversation_reopened} audit parity (system actor,
 *       {@code reason=inbound_message}, old/new status);</li>
 *   <li><b>activity refresh</b> — every inbound refreshes
 *       {@code last_activity_at} (and {@code updated_at}), baseline
 *       parity.</li>
 * </ul>
 */
@Service
public class ConversationIngressService {

    private final ConversationRepository conversations;

    private final AuditPersistence audit;

    private final ObjectMapper mapper;

    public ConversationIngressService(ConversationRepository conversations,
            AuditPersistence audit, ObjectMapper mapper) {
        this.conversations = conversations;
        this.audit = audit;
        this.mapper = mapper;
    }

    /**
     * Finds or creates the conversation for one inbound connector message
     * (POC upsert parity — see the class javadoc) and returns its id.
     *
     * @param platform         the channel label ({@code telegram} |
     *                         {@code irc}); unknown labels fail closed
     * @param externalThreadId platform thread id (required)
     * @param ircProfileId     resolved IRC profile id; null for Telegram and
     *                         for the IRC config-store fallback (G12)
     * @return the conversation id
     */
    @Transactional
    public UUID findOrCreateForInbound(String platform, String externalThreadId,
            Integer ircProfileId) {
        ChannelType channel = ChannelType.fromLabel(platform);
        if (externalThreadId == null || externalThreadId.isBlank()) {
            throw new IllegalArgumentException("Missing externalThreadId in inbound event");
        }
        Conversation conversation = findFirst(channel, externalThreadId, ircProfileId)
                .orElseGet(() -> create(channel, externalThreadId, ircProfileId));
        touchInboundActivity(conversation);
        return conversation.getId();
    }

    private java.util.Optional<Conversation> findFirst(ChannelType channel,
            String externalThreadId, Integer ircProfileId) {
        // POC parity: the profile condition applies only when the event
        // carries a profile id; otherwise the match is (channel, thread) —
        // the same relaxed lookup the baseline Drizzle where-clause built.
        Specification<Conversation> spec = ConversationRepository.hasChannel(channel)
                .and(ConversationRepository.hasExternalThreadId(externalThreadId));
        if (ircProfileId != null) {
            spec = spec.and(ConversationRepository.hasIrcProfileId(ircProfileId));
        }
        List<Conversation> matches = conversations
                .findAll(spec, PageRequest.of(0, 1)).getContent();
        return matches.isEmpty() ? java.util.Optional.empty()
                : java.util.Optional.of(matches.getFirst());
    }

    private Conversation create(ChannelType channel, String externalThreadId,
            Integer ircProfileId) {
        Conversation conversation = new Conversation(UUID.randomUUID(), channel,
                externalThreadId);
        conversation.setTitle(externalThreadId);
        conversation.setStatus(ConversationStatus.OPEN);
        conversation.setPriority(ConversationPriority.NORMAL);
        conversation.setIrcProfileId(ircProfileId);
        ObjectNode metadata = mapper.createObjectNode()
                .put("source", channel.getLabel() + "_adapter");
        conversation.setMetadata(metadata.toString());
        return conversations.saveAndFlush(conversation);
    }

    /**
     * Baseline inbound-activity parity: {@code resolved} reopens to
     * {@code open} with the reopen audit, and {@code last_activity_at}/
     * {@code updated_at} refresh on every inbound.
     */
    private void touchInboundActivity(Conversation conversation) {
        LocalDateTime now = LocalDateTime.now();
        if (conversation.getStatus() == ConversationStatus.RESOLVED) {
            conversation.setStatus(ConversationStatus.OPEN);
            audit.persist(new AuditRecord("conversation_reopened", "conversation",
                    conversation.getId().toString(), null, reopenMetadata(), null));
        }
        conversation.setLastActivityAt(now);
        conversation.setUpdatedAt(now);
        conversations.save(conversation);
    }

    private ObjectNode reopenMetadata() {
        return mapper.createObjectNode()
                .put("reason", "inbound_message")
                .put("oldStatus", "resolved")
                .put("newStatus", "open");
    }
}
