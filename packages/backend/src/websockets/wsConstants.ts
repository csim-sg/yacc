/**
 * WebSocket Constants
 *
 * Centralized constants for WebSocket events and configuration
 */

// ============================================
// WebSocket Event Types (dot notation standardized)
// ============================================

/**
 * Message-related events
 */
export const MessageEvents = {
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_FAILED: 'message.failed',
} as const;

/**
 * Conversation-related events
 */
export const ConversationEvents = {
  CONVERSATION_UPDATED: 'conversation.updated',
  CONVERSATION_REOPENED: 'conversation.reopened',
} as const;

/**
 * Notification events
 */
export const NotificationEvents = {
  NOTIFICATION_RECEIVED: 'notification.received',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_DISMISSED: 'notification.dismissed',
} as const;

/**
 * Presence and typing events
 */
export const PresenceEvents = {
  PRESENCE_UPDATED: 'presence.updated',
  TYPING_STARTED: 'typing.started',
  TYPING_STOPPED: 'typing.stopped',
} as const;

/**
 * All WebSocket event types
 */
export type WebSocketEventType =
  | MessageEvents[keyof typeof MessageEvents]
  | ConversationEvents[keyof typeof ConversationEvents]
  | NotificationEvents[keyof typeof NotificationEvents]
  | PresenceEvents[keyof typeof PresenceEvents];

// ============================================
// WebSocket Configuration
// ============================================

/**
 * Ping/heartbeat interval in milliseconds (60 seconds)
 */
export const PING_INTERVAL_MS = 60000;

/**
 * Timeout for WebSocket connection in milliseconds (1 hour)
 */
export const CONNECTION_TIMEOUT_MS = 3600000;

/**
 * Reconnection configuration
 */
export const RECONNECT_CONFIG = {
  /**
   * Initial backoff delay in milliseconds
   */
  INITIAL_DELAY_MS: 1000,

  /**
   * Maximum backoff delay in milliseconds
   */
  MAX_DELAY_MS: 60000,

  /**
   * Maximum number of reconnection attempts before giving up
   */
  MAX_ATTEMPTS: 5,

  /**
   * Exponential backoff factor
   */
  BACKOFF_FACTOR: 2,
} as const;

/**
 * Message backlog on reconnect (1 hour)
 */
export const MESSAGE_BACKLOG_DURATION_MS = 3600000;

/**
 * Typing indicator timeout in milliseconds (5 seconds)
 */
export const TYPING_TIMEOUT_MS = 5000;
