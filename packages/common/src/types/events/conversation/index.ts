/**
 * Conversation Event Types
 *
 * WebSocket events related to conversation lifecycle:
 * - conversation.updated: Conversation status, priority, or assignment changes
 * - conversation.reopened: Resolved conversation auto-reopens
 *
 * @module @yacc/common/types/events/conversation
 */

export type {
  ConversationUpdatedEvent,
  ConversationUpdatedPayload,
  ConversationUpdatedFields,
} from './conversation-updated.event';
export type {
  ConversationReopenedEvent,
  ConversationReopenedPayload,
  ConversationReopenedReason,
  ConversationSummary,
} from './conversation-reopened.event';
