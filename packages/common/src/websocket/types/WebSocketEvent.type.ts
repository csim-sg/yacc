/**
 * WebSocket Event Types
 *
 * Union types for all WebSocket events
 *
 * @module @yacc/common/websocket/types
 */

import type { MessagePayload } from './MessagePayload.type';
import type { ConversationPayload } from './ConversationPayload.type';
import type { NotificationPayload } from './NotificationPayload.type';
import type { PresencePayload } from './PresencePayload.type';
import type { SystemPayload } from './SystemPayload.type';

/**
 * Union type of all possible WebSocket event payloads
 *
 * Use this when handling generic WebSocket events
 */
export type WebSocketEventPayload =
  | MessagePayload
  | ConversationPayload
  | NotificationPayload
  | PresencePayload
  | SystemPayload;

/**
 * Generic WebSocket event message structure
 *
 * All events follow this envelope format
 */
export interface WebSocketEventMessage {
  /** Event type (e.g., 'message.received', 'conversation.updated') */
  type: string;

  /** Event payload (type-specific) */
  payload: WebSocketEventPayload;

  /** ISO 8601 timestamp when event was created */
  timestamp: string;
}
