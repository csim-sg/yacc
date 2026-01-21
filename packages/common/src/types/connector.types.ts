/**
 * Connector Types
 *
 * Standard types for IRC and Telegram connector implementations
 */

import type { EventEmitter } from 'events';

// ============================================
// Platform Types
// ============================================

export type Platform = 'telegram' | 'irc';

// ============================================
// Connector Status
// ============================================

export type ConnectorStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

// ============================================
// Message Direction
// ============================================

export type MessageDirection = 'inbound' | 'outbound';

// ============================================
// Connector Message (Unified Schema)
// ============================================

export interface ConnectorMessage {
  // Platform-unique identifier (Telegram user_id, IRC nick)
  senderId: string;

  // Display name (Telegram username/first_name, IRC nick)
  senderName: string;

  // Where message came from / going to
  direction: MessageDirection;

  // Message body text
  body: string;

  // External message ID (Telegram message_id, IRC message ID)
  externalMessageId?: string;

  // Reply-to message ID for threading
  replyToMessageId?: string;

  // Attachments (optional)
  attachments?: ConnectorAttachment[];

  // Timestamp (when message was sent/received)
  timestamp: Date;

  // Platform-specific metadata (JSON)
  metadata?: Record<string, unknown>;

  // Whether message is edited
  isEdited?: boolean;

  // Whether message is forwarded (from another user/channel)
  isForwarded?: boolean;

  // CTCP action (for IRC: /me waves)
  ctcpAction?: string;
}

// ============================================
// Connector Attachment
// ============================================

export interface ConnectorAttachment {
  // Original URL from platform
  originalUrl?: string;

  // CDN URL after re-hosting
  cdnUrl?: string;

  // Storage key in R2
  storageKey?: string;

  // File type (image/jpeg, video/mp4, etc.)
  mimeType: string;

  // Original filename
  name: string;

  // File size in bytes
  size: number;

  // Width/height for images/videos
  width?: number;
  height?: number;
}

// ============================================
// Connector Configuration
// ============================================

export interface ConnectorConfig<T extends Platform = Platform> {
  platform: T;

  // Telegram-specific config
  botToken?: string;
  webhookUrl?: string;

  // IRC-specific config
  server?: string;
  port?: number;
  username?: string;
  password?: string;
  channels?: string[]; // Channels to auto-join
  useSSL?: boolean;
}

// ============================================
// Connection Information
// ============================================

export interface ConnectionInfo {
  status: ConnectorStatus;
  lastConnectedAt?: Date;
  lastDisconnectedAt?: Date;
  reconnectAttempts?: number;
  errorMessage?: string;
}

// ============================================
// Send Message Request
// ============================================

export interface SendMessageRequest {
  // Where to send (Telegram chat_id, IRC channel)
  channelId: string;

  // Message body text
  body: string;

  // Optional attachments (CDN URLs)
  attachments?: Omit<ConnectorAttachment, 'originalUrl'>[];

  // Optional reply-to
  replyToMessageId?: string;
}

// ============================================
// Send Message Response
// ============================================

export interface SendMessageResponse {
  // Whether send succeeded
  success: boolean;

  // Platform message ID (Telegram message_id, IRC message ID)
  messageId?: string;

  // Error details (if failed)
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

// ============================================
// Connector Events
// ============================================

export type ConnectorEventMap = {
  // Connection lifecycle
  connected: () => void;
  disconnected: () => void;
  reconnecting: (attempt: number) => void;
  reconnect_failed: () => void;

  // Message flow
  message_received: (message: ConnectorMessage) => void;
  message_sent: (response: SendMessageResponse) => void;
  message_failed: (error: { messageId: string; error: Error }) => void;

  // Integration status
  integration_connected: (platform: Platform) => void;
  integration_disconnected: (platform: Platform) => void;
};

// ============================================
// Connector Error Types
// ============================================

export class ConnectionError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public code: string = 'CONNECTION_ERROR'
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class MessageSendError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public messageId: string,
    public code: string = 'SEND_ERROR',
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'MessageSendError';
  }
}

export class MessageParseError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public code: string = 'PARSE_ERROR',
    public rawPayload?: unknown
  ) {
    super(message);
    this.name = 'MessageParseError';
  }
}

export class AuthenticationError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public code: string = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// ============================================
// IConnector Interface
// ============================================

export interface IConnector<T extends Platform = Platform>
  extends EventEmitter,
    Pick<ConnectorEventMap, string>
{
  // Platform identifier
  readonly platform: T;

  /**
   * Connect to the platform
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the platform
   */
  disconnect(): Promise<void>;

  /**
   * Send a message to the platform
   */
  sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionInfo;

  /**
   * Whether connector is currently connected
   */
  isConnected(): boolean;

  /**
   * Validate configuration
   */
  validateConfig(config: ConnectorConfig<T>): Promise<ValidationError[]>;

  /**
   * Clean up resources
   */
  destroy(): Promise<void>;
}

// ============================================
// Validation Error
// ============================================

export interface ValidationError {
  field: string;
  message: string;
}

// ============================================
// Raw Payload Storage Info
// ============================================

export interface RawPayloadInfo {
  messageId: string;
  payload: unknown;
  timestamp: Date;
  expiresAt: Date;
}

// ============================================
// Retry Job Data
// ============================================

export interface RetryJobData {
  messageId: string;
  conversationId: string;
  platform: Platform;
  attemptNumber: number;
  attemptAt: Date;
  lastError?: string;
}

// ============================================
// Export all types
// ============================================

export type {
  Platform,
  ConnectorStatus,
  MessageDirection,
  ConnectorMessage,
  ConnectorAttachment,
  ConnectorConfig,
  ConnectionInfo,
  SendMessageRequest,
  SendMessageResponse,
  ConnectorEventMap,
  IConnector,
  ValidationError,
  RawPayloadInfo,
  RetryJobData,
  ConnectionError,
  MessageSendError,
  MessageParseError,
  AuthenticationError,
};
