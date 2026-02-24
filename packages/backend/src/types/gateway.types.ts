/**
 * Gateway Types
 *
 * Type definitions for the gateway-exchange service.
 * These interfaces define the unified structure for message flow
 * between external platforms and the YACC system.
 *
 * @see ADR-005 Addendum-2 - Interface Definitions
 */

/**
 * Supported platform types
 */
export type Platform = 'telegram' | 'irc';

/**
 * Attachment information for messages
 */
export interface MessageAttachment {
  /** Platform-provided URL (will be re-hosted to R2 for inbound) */
  url: string;
  /** MIME type (e.g., 'image/png', 'application/pdf') */
  type: string;
  /** Original filename */
  name: string;
  /** File size in bytes (for 5MB validation) */
  size?: number;
}

/**
 * Unified structure for all inbound messages from external platforms.
 *
 * Emitted by PlatformAdapter via 'message:inbound' event,
 * consumed by GatewayExchange.handleInbound().
 */
export interface InboundMessageEvent {
  /** Platform that sent the message */
  platform: Platform;
  /** Unique identifier per platform (Telegram group ID, IRC channel name) */
  externalThreadId: string;
  /** Sender information */
  sender: {
    /** Platform-specific user ID */
    externalUserId: string;
    /** Human-readable display name */
    displayName: string;
  };
  /** Message text content */
  body: string;
  /** Optional attachments */
  attachments?: MessageAttachment[];
  /** Platform timestamp (or adapter receipt time if unavailable) */
  receivedAt: Date;
  /** Full platform response (for R2 storage per audit requirements) */
  rawPayload: unknown;
  /** Optional: For distributed tracing */
  correlationId?: string;
  /** Optional: IRC profile ID for profile-scoped conversations */
  ircProfileId?: number;
}

/**
 * Unified structure for all outbound messages sent to external platforms.
 *
 * Created by message.service.ts, passed to PlatformAdapter.send(),
 * enqueued by BullMQ retry worker.
 */
export interface OutboundMessagePayload {
  /** YACC conversation UUID */
  conversationId: string;
  /** Message text to send */
  body: string;
  /** Optional attachments (R2 URLs from frontend upload) */
  attachments?: MessageAttachment[];
  /** YACC user ID (for audit logging) */
  userId: string;
  /** Optional: For safe retries (prevents duplicate sends) */
  idempotencyKey?: string;
  /** Optional: Platform-specific data */
  metadata?: Record<string, unknown>;
  /** Optional: For distributed tracing */
  correlationId?: string;
}

/**
 * Error information in SendResult
 */
export interface SendError {
  /** Error code for categorization */
  code:
    | 'RATE_LIMIT'
    | 'INVALID_CREDENTIALS'
    | 'NETWORK_ERROR'
    | 'MESSAGE_TOO_LONG'
    | 'ATTACHMENT_TOO_LARGE'
    | 'UNKNOWN_ERROR';
  /** Human-readable error message */
  message: string;
  /** Should BullMQ retry this message? */
  retryable: boolean;
}

/**
 * Result object returned by PlatformAdapter.send().
 *
 * Consumed by message.service.ts to update message status,
 * BullMQ worker for retry logic.
 */
export interface SendResult {
  /** Whether the send was successful */
  success: boolean;
  /** Platform-specific ID (required if success=true) */
  externalMessageId?: string;
  /** Error details (required if success=false) */
  error?: SendError;
  /** When send attempt occurred (for audit correlation) */
  timestamp: Date;
}

/**
 * Adapter status type
 */
export type AdapterStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Health check result from adapter
 */
export interface HealthCheckResult {
  /** Is the adapter healthy? */
  healthy: boolean;
  /** Error details if unhealthy */
  details?: string;
  /** Last message timestamp (for staleness detection) */
  lastMessageAt?: Date;
}

/**
 * Event payload for adapter:disconnected event
 */
export interface AdapterDisconnectedEvent {
  /** Reason for disconnection */
  reason: string;
}
