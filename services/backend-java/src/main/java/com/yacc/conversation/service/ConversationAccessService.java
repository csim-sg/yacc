package com.yacc.conversation.service;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.UserRole;
import com.yacc.conversation.repository.ConversationRepository;

/**
 * Public resource-level access API of the {@code conversation} bounded
 * context (POC {@code authorization.service} parity; ledger row REST-TAG-003
 * "resource-level canAccessConversation"): privileged roles access every
 * conversation; {@code user} role only when assigned. Unknown roles and
 * missing conversations deny (fail-closed).
 */
@Service
public class ConversationAccessService {

    private final ConversationRepository conversations;

    public ConversationAccessService(ConversationRepository conversations) {
        this.conversations = conversations;
    }

    /** True when the identity may access the conversation (fail-closed). */
    @Transactional(readOnly = true)
    public boolean canAccess(AuthUser user, UUID conversationId) {
        UserRole role = user.getRole();
        if (role == UserRole.SUPER_ADMIN || role == UserRole.ADMIN || role == UserRole.MANAGER) {
            return true;
        }
        if (role == UserRole.USER) {
            return conversations.findById(conversationId)
                    .map(conversation -> user.getId().equals(conversation.getAssignedUserId()))
                    .orElse(false);
        }
        return false;
    }

    /** True when the conversation exists. */
    @Transactional(readOnly = true)
    public boolean exists(UUID conversationId) {
        return conversations.existsById(conversationId);
    }

    /** True when the conversation exists and is assigned to the user. */
    @Transactional(readOnly = true)
    public boolean isAssignedTo(UUID conversationId, String userId) {
        return conversations.existsByIdAndAssignedUserId(conversationId, userId);
    }
}
