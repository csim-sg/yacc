/**
 * WebSocket Event Types
 *
 * Type definitions for all WebSocket events in the YACC system.
 * Uses discriminated union pattern for type-safe event handling.
 *
 * @module @yacc/common/types/events
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

// Base types
export type { BaseEvent, WebSocketEventName } from './base.event';

// Message events
export type {
  MessageReceivedEvent,
  MessageReceivedPayload,
  MessageSentEvent,
  MessageSentPayload,
  MessageFailedEvent,
  MessageFailedPayload,
} from './message';

// Conversation events
export type {
  ConversationUpdatedEvent,
  ConversationUpdatedPayload,
  ConversationUpdatedFields,
  ConversationReopenedEvent,
  ConversationReopenedPayload,
  ConversationReopenedReason,
  ConversationSummary,
} from './conversation';

// Notification events
export type {
  NotificationReceivedEvent,
  NotificationReceivedPayload,
  NotificationConversationPreview,
} from './notification';

// Presence events
export type {
  PresenceUpdatedEvent,
  PresenceUpdatedPayload,
  PresenceStatus,
  TypingStartedEvent,
  TypingStartedPayload,
  TypingStoppedEvent,
  TypingStoppedPayload,
} from './presence';

// Type guards
export {
  isMessageEvent,
  isConversationEvent,
  isNotificationEvent,
  isPresenceEvent,
} from './guards';

// Re-export for discriminated union
import type { MessageReceivedEvent } from './message';
import type { MessageSentEvent } from './message';
import type { MessageFailedEvent } from './message';
import type { ConversationUpdatedEvent } from './conversation';
import type { ConversationReopenedEvent } from './conversation';
import type { NotificationReceivedEvent } from './notification';
import type { PresenceUpdatedEvent } from './presence';
import type { TypingStartedEvent } from './presence';
import type { TypingStoppedEvent } from './presence';

/**
 * Discriminated union of all WebSocket events
 *
 * Use this type for type-safe event handling with automatic narrowing
 * based on the `event` discriminator field.
 *
 * @example
 * ```typescript
 * function handleWebSocketEvent(event: WebSocketEvent): void {
 *   switch (event.event) {
 *     case 'message.received':
 *       // TypeScript knows event.payload is MessageReceivedPayload
 *       console.log(`New message: ${event.payload.body}`);
 *       break;
 *     case 'message.sent':
 *       // TypeScript knows event.payload is MessageSentPayload
 *       updateMessageStatus(event.payload.messageId, 'sent');
 *       break;
 *     case 'message.failed':
 *       // TypeScript knows event.payload is MessageFailedPayload
 *       handleFailedMessage(event.payload);
 *       break;
 *     case 'conversation.updated':
 *       // TypeScript knows event.payload is ConversationUpdatedPayload
 *       updateConversation(event.payload.conversationId, event.payload.updatedFields);
 *       break;
 *     case 'conversation.reopened':
 *       // TypeScript knows event.payload is ConversationReopenedPayload
 *       moveConversationToOpen(event.payload.conversation.id);
 *       break;
 *     case 'notification.received':
 *       // TypeScript knows event.payload is NotificationReceivedPayload
 *       showNotificationToast(event.payload.message);
 *       break;
 *     case 'presence.updated':
 *       // TypeScript knows event.payload is PresenceUpdatedPayload
 *       updateUserPresence(event.payload.userId, event.payload.status);
 *       break;
 *     case 'typing.started':
 *       // TypeScript knows event.payload is TypingStartedPayload
 *       showTypingIndicator(event.payload.conversationId, event.payload.userName);
 *       break;
 *     case 'typing.stopped':
 *       // TypeScript knows event.payload is TypingStoppedPayload
 *       hideTypingIndicator(event.payload.conversationId, event.payload.userId);
 *       break;
 *   }
 * }
 * ```
 */
export type WebSocketEvent =
  | MessageReceivedEvent
  | MessageSentEvent
  | MessageFailedEvent
  | ConversationUpdatedEvent
  | ConversationReopenedEvent
  | NotificationReceivedEvent
  | PresenceUpdatedEvent
  | TypingStartedEvent
  | TypingStoppedEvent;
