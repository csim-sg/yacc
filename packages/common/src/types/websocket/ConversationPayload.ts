/**
 * Conversation Payloads
 *
 * WebSocket event payload types for conversation-related events
 */

/**
 * Payload for conversation.updated event
 */
export interface ConversationUpdatedPayload {
  conversationId: string;
  changes: {
    status?: 'open' | 'pending' | 'resolved';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignedUserId?: string;
  };
  updatedAt: string;
}

/**
 * Payload for conversation.reopened event
 */
export interface ConversationReopenedPayload {
  conversationId: string;
  reopenedAt: string;
  triggerMessageId: string;
}
