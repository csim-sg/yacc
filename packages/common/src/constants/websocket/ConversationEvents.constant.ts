/**
 * Conversation Events
 *
 * Conversation-related WebSocket event types
 */

export const CONVERSATION_UPDATED = 'conversation.updated' as const;
export const CONVERSATION_REOPENED = 'conversation.reopened' as const;

export const ConversationEvents = {
  CONVERSATION_UPDATED,
  CONVERSATION_REOPENED,
} as const;

export type ConversationEventType = typeof ConversationEvents[keyof typeof ConversationEvents];
