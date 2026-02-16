/**
 * WebSocket Event Types and Payloads
 *
 * Defines all event payload interfaces for real-time communication
 * Events are emitted server → client via Socket.io
 */

import { z } from 'zod';

// ============================================
// Event Payload Schemas (Zod for validation)
// ============================================

/**
 * conversation.updated event
 * Emitted when: status/priority/assignment changes
 */
export const ConversationUpdatedPayloadSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  updatedFields: z.record(z.string(), z.any()).describe('Fields that changed'),
  changedBy: z.string().uuid('Invalid user ID'),
  changedAt: z.string().datetime('Invalid timestamp'),
});
export type ConversationUpdatedPayload = z.infer<typeof ConversationUpdatedPayloadSchema>;

/**
 * message.sent event
 * Emitted when: message successfully delivered to platform
 */
export const MessageSentPayloadSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  conversationId: z.string().uuid('Invalid conversation ID'),
  status: z.literal('sent'),
  sentAt: z.string().datetime('Invalid timestamp'),
});
export type MessageSentPayload = z.infer<typeof MessageSentPayloadSchema>;

/**
 * message.received event
 * Emitted when: inbound message arrives from platform (Telegram, IRC, etc.)
 */
export const MessageReceivedPayloadSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  conversationId: z.string().uuid('Invalid conversation ID'),
  platform: z.enum(['telegram', 'irc']).describe('Source platform ("telegram" or "irc")'),
  senderId: z.string().min(1, 'Sender ID required').describe('Platform sender identifier (e.g., Telegram user ID or IRC nick)'),
  body: z.string().min(1, 'Message body required'),
  senderName: z.string().min(1, 'Sender name required'),
  timestamp: z.string().datetime('Invalid timestamp'),
  attachments: z
    .array(
      z.object({
        url: z.string().url('Invalid attachment URL'),
        type: z.string().min(1, 'Attachment type required'),
        name: z.string().min(1, 'Attachment name required'),
      })
    )
    .optional(),
});
export type MessageReceivedPayload = z.infer<typeof MessageReceivedPayloadSchema>;

/**
 * message.failed event
 * Emitted when: message delivery fails (will retry)
 */
export const MessageFailedPayloadSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  conversationId: z.string().uuid('Invalid conversation ID'),
  status: z.literal('failed'),
  error: z.string().describe('Error message'),
  retryAt: z.string().datetime('Invalid timestamp'),
  attempt: z.number().int().min(1).max(3).describe('Retry attempt number'),
});
export type MessageFailedPayload = z.infer<typeof MessageFailedPayloadSchema>;

/**
 * typing.started event
 * Emitted when: user starts typing in conversation
 */
export const TypingStartedPayloadSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  userId: z.string().uuid('Invalid user ID'),
  name: z.string().min(1, 'Name required'),
});
export type TypingStartedPayload = z.infer<typeof TypingStartedPayloadSchema>;

/**
 * typing.stopped event
 * Emitted when: user stops typing (timeout or explicit)
 */
export const TypingStoppedPayloadSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  userId: z.string().uuid('Invalid user ID'),
});
export type TypingStoppedPayload = z.infer<typeof TypingStoppedPayloadSchema>;

/**
 * presence.updated event
 * Emitted when: user comes online/offline
 */
export const PresenceUpdatedPayloadSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  status: z.enum(['online', 'offline']),
  lastSeen: z.string().datetime('Invalid timestamp'),
});
export type PresenceUpdatedPayload = z.infer<typeof PresenceUpdatedPayloadSchema>;

/**
 * reaction.added event
 * Emitted when: user adds emoji reaction to message
 */
export const ReactionAddedPayloadSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  conversationId: z.string().uuid('Invalid conversation ID'),
  emoji: z.string().emoji('Invalid emoji'),
  userId: z.string().uuid('Invalid user ID'),
  name: z.string().min(1, 'Name required'),
});
export type ReactionAddedPayload = z.infer<typeof ReactionAddedPayloadSchema>;

/**
 * reaction.removed event
 * Emitted when: user removes emoji reaction from message
 */
export const ReactionRemovedPayloadSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  conversationId: z.string().uuid('Invalid conversation ID'),
  emoji: z.string().emoji('Invalid emoji'),
  userId: z.string().uuid('Invalid user ID'),
});
export type ReactionRemovedPayload = z.infer<typeof ReactionRemovedPayloadSchema>;

// ============================================
// Union Types for All Events
// ============================================

/**
 * All possible event payloads
 */
export type WebSocketEventPayload =
  | ConversationUpdatedPayload
  | MessageReceivedPayload
  | MessageSentPayload
  | MessageFailedPayload
  | TypingStartedPayload
  | TypingStoppedPayload
  | PresenceUpdatedPayload
  | ReactionAddedPayload
  | ReactionRemovedPayload;

/**
 * Event type to payload mapping for type-safe event emission
 */
export type WebSocketEventMap = {
  'conversation.updated': ConversationUpdatedPayload;
  'message.received': MessageReceivedPayload;
  'message.sent': MessageSentPayload;
  'message.failed': MessageFailedPayload;
  'typing.started': TypingStartedPayload;
  'typing.stopped': TypingStoppedPayload;
  'presence.updated': PresenceUpdatedPayload;
  'reaction.added': ReactionAddedPayload;
  'reaction.removed': ReactionRemovedPayload;
};

// ============================================
// Event Handler Type
// ============================================

/**
 * Event handler function signature
 * Receives event payload and emits to clients
 */
export type WebSocketEventHandler<K extends keyof WebSocketEventMap> = (
  payload: WebSocketEventMap[K]
) => Promise<void>;

/**
 * Handler registry mapping event names to handlers
 */
export type WebSocketHandlerRegistry = {
  [K in keyof WebSocketEventMap]: WebSocketEventHandler<K>;
};
