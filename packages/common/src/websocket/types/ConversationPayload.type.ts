/**
 * Conversation Payload Types
 *
 * Type definitions for conversation-related WebSocket event payloads
 *
 * @module @yacc/common/websocket/types
 */

/** Tag attached to a conversation */
export interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

/**
 * Conversation payload for WebSocket events
 *
 * Used for:
 * - conversation.updated: Conversation state changed
 * - conversation.reopened: Resolved conversation got new activity
 */
export interface ConversationPayload {
  /** Unique conversation identifier */
  id: string;

  /** Channel type (telegram, irc) */
  channel: string;

  /** External platform thread ID */
  externalThreadId: string;

  /** Conversation title/subject */
  title: string;

  /** Current conversation status */
  status: 'open' | 'pending' | 'resolved';

  /** Current priority level */
  priority: 'low' | 'medium' | 'high' | 'urgent';

  /** ID of assigned user (if any) */
  assignedUserId?: string;

  /** Tags attached to this conversation */
  tags: ConversationTag[];

  /** ISO 8601 timestamp of last message */
  lastMessageAt: string;

  /** Count of unread messages */
  unreadCount: number;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}
