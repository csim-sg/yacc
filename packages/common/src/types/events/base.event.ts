/**
 * Base WebSocket Event Type
 *
 * Foundation type for all WebSocket events in the YACC system.
 * Uses discriminated union pattern for type-safe event handling.
 *
 * @module @yacc/common/types/events
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

/**
 * All possible WebSocket event names in the YACC system
 *
 * Message Events:
 * - message.received: New inbound message arrives from Telegram or IRC
 * - message.sent: Outbound message successfully delivered to platform
 * - message.failed: Outbound message fails to deliver (will retry)
 *
 * Conversation Events:
 * - conversation.updated: Conversation status, priority, or assignment changes
 * - conversation.reopened: Resolved conversation auto-reopens due to new inbound message
 *
 * Notification Events:
 * - notification.received: User receives a new notification (assignment, mention)
 *
 * Presence Events:
 * - presence.updated: User logs in/out or goes idle
 * - typing.started: User starts typing in a conversation
 * - typing.stopped: User stops typing (after 5 second inactivity)
 */
export type WebSocketEventName =
  | 'message.received'
  | 'message.sent'
  | 'message.failed'
  | 'conversation.updated'
  | 'conversation.reopened'
  | 'notification.received'
  | 'presence.updated'
  | 'typing.started'
  | 'typing.stopped';

/**
 * Base event interface for all WebSocket events
 *
 * @template TEventName - The literal event name type for discrimination
 * @template TPayload - The event-specific payload type
 *
 * @example
 * ```typescript
 * interface MessageReceivedEvent extends BaseEvent<'message.received', MessageReceivedPayload> {}
 * ```
 */
export interface BaseEvent<
  TEventName extends WebSocketEventName,
  TPayload,
> {
  /** The event name (used for discriminated union type narrowing) */
  event: TEventName;
  /** The event-specific payload data */
  payload: TPayload;
  /** ISO8601 timestamp when the event was emitted */
  timestamp: string;
}
