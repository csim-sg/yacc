/**
 * WebSocket Constants
 *
 * Constants and configuration for WebSocket server
 */

// ============================================
// WebSocket Configuration
// ============================================

export const WS_CONFIG = {
  /**
   * WebSocket path
   */
  PATH: '/ws',

  /**
   * Ping interval for connection health check
   */
  PING_INTERVAL: 60000, // 60 seconds

  /**
   * Pong timeout
   */
  PONG_TIMEOUT: 5000, // 5 seconds

  /**
   * Connection timeout
   */
  CONNECTION_TIMEOUT: 120000, // 2 minutes

  /**
   * Maximum message size
   */
  MAX_MESSAGE_SIZE: 1024 * 1024, // 1MB

  /**
   * Maximum reconnection attempts
   */
  MAX_RECONNECT_ATTEMPTS: 10,

  /**
   * Reconnection backoff delays (ms)
   */
  RECONNECT_DELAYS: [1000, 2000, 4000, 8000, 16000, 30000],
};

// ============================================
// WebSocket Events
// ============================================

export const WS_EVENTS = {
  /**
   * Connection established
   */
  CONNECTED: 'connected',

  /**
   * Connection closed
   */
  DISCONNECTED: 'disconnected',

  /**
   * Error occurred
   */
  ERROR: 'error',

  /**
   * Message received
   */
  MESSAGE_RECEIVED: 'message.received',

  /**
   * Message sent
   */
  MESSAGE_SENT: 'message.sent',

  /**
   * Message failed
   */
  MESSAGE_FAILED: 'message.failed',

  /**
   * Conversation updated
   */
  CONVERSATION_UPDATED: 'conversation.updated',

  /**
   * Notification received
   */
  NOTIFICATION_RECEIVED: 'notification.received',

  /**
   * Typing started
   */
  TYPING_STARTED: 'typing.started',

  /**
   * Typing stopped
   */
  TYPING_STOPPED: 'typing.stopped',

  /**
   * Presence updated
   */
  PRESENCE_UPDATED: 'presence.updated',

  /**
   * Integration connected
   */
  INTEGRATION_CONNECTED: 'integration.connected',

  /**
   * Integration disconnected
   */
  INTEGRATION_DISCONNECTED: 'integration.disconnected',
};

// ============================================
// Event Payload Types
// ============================================

export interface MessageEventPayload {
  messageId: string;
  conversationId: string;
  platform: 'telegram' | 'irc';
  direction: 'inbound' | 'outbound';
  timestamp: Date;
}

export interface ConversationEventPayload {
  conversationId: string;
  updateType: 'status' | 'assignee' | 'tag' | 'priority';
  oldValue?: any;
  newValue?: any;
}

export interface NotificationEventPayload {
  notificationId: string;
  userId: string;
  type: 'assignment' | 'mention';
  conversationId: string;
}

export interface TypingEventPayload {
  conversationId: string;
  userId: string;
}

export interface PresenceEventPayload {
  userId: string;
  status: 'online' | 'offline';
}

export interface IntegrationEventPayload {
  platform: 'telegram' | 'irc';
  status: 'connected' | 'disconnected' | 'error';
  message?: string;
}
