/**
 * WebSocket Event Types
 *
 * Union type for all WebSocket event types
 */

import type { MessageEventType } from '../../constants/websocket/MessageEvents.constant';
import type { ConversationEventType } from '../../constants/websocket/ConversationEvents.constant';
import type { NotificationEventType } from '../../constants/websocket/NotificationEvents.constant';
import type { PresenceEventType } from '../../constants/websocket/PresenceEvents.constant';

export type WebSocketEventType =
  | MessageEventType
  | ConversationEventType
  | NotificationEventType
  | PresenceEventType;
