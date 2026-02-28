/**
 * WebSocket Event Type Guards
 *
 * Type guard functions for narrowing WebSocket event types.
 * These functions enable runtime type checking with discriminated unions.
 *
 * @module @yacc/common/types/events
 */

import type { WebSocketEvent } from './index';
import type {
  MessageReceivedEvent,
  MessageSentEvent,
  MessageFailedEvent,
} from './message';
import type {
  ConversationUpdatedEvent,
  ConversationReopenedEvent,
} from './conversation';
import type { NotificationReceivedEvent } from './notification';
import type {
  PresenceUpdatedEvent,
  TypingStartedEvent,
  TypingStoppedEvent,
} from './presence';

/**
 * Type guard to check if an event is a message event
 *
 * @param event - The WebSocket event to check
 * @returns True if the event is a message.received, message.sent, or message.failed event
 *
 * @example
 * ```typescript
 * if (isMessageEvent(event)) {
 *   // TypeScript knows event is MessageReceivedEvent | MessageSentEvent | MessageFailedEvent
 *   console.log(`Message event for conversation: ${event.payload.conversationId}`);
 * }
 * ```
 */
export function isMessageEvent(
  event: WebSocketEvent
): event is MessageReceivedEvent | MessageSentEvent | MessageFailedEvent {
  return (
    event.event === 'message.received' ||
    event.event === 'message.sent' ||
    event.event === 'message.failed'
  );
}

/**
 * Type guard to check if an event is a conversation event
 *
 * @param event - The WebSocket event to check
 * @returns True if the event is a conversation.updated or conversation.reopened event
 *
 * @example
 * ```typescript
 * if (isConversationEvent(event)) {
 *   // TypeScript knows event is ConversationUpdatedEvent | ConversationReopenedEvent
 *   console.log(`Conversation event: ${event.event}`);
 * }
 * ```
 */
export function isConversationEvent(
  event: WebSocketEvent
): event is ConversationUpdatedEvent | ConversationReopenedEvent {
  return (
    event.event === 'conversation.updated' ||
    event.event === 'conversation.reopened'
  );
}

/**
 * Type guard to check if an event is a notification event
 *
 * @param event - The WebSocket event to check
 * @returns True if the event is a notification.received event
 *
 * @example
 * ```typescript
 * if (isNotificationEvent(event)) {
 *   // TypeScript knows event is NotificationReceivedEvent
 *   showNotificationToast(event.payload.message);
 * }
 * ```
 */
export function isNotificationEvent(
  event: WebSocketEvent
): event is NotificationReceivedEvent {
  return event.event === 'notification.received';
}

/**
 * Type guard to check if an event is a presence event
 *
 * @param event - The WebSocket event to check
 * @returns True if the event is a presence.updated, typing.started, or typing.stopped event
 *
 * @example
 * ```typescript
 * if (isPresenceEvent(event)) {
 *   // TypeScript knows event is PresenceUpdatedEvent | TypingStartedEvent | TypingStoppedEvent
 *   console.log(`Presence event: ${event.event}`);
 * }
 * ```
 */
export function isPresenceEvent(
  event: WebSocketEvent
): event is PresenceUpdatedEvent | TypingStartedEvent | TypingStoppedEvent {
  return (
    event.event === 'presence.updated' ||
    event.event === 'typing.started' ||
    event.event === 'typing.stopped'
  );
}
