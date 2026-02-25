/**
 * Platform Adapter Interface
 *
 * Unified interface for all platform integrations (Telegram, IRC, future platforms).
 *
 * Responsibilities:
 * - Inbound: Receive messages from platform, emit InboundMessageEvent via EventEmitter
 * - Outbound: Send messages to platform, return SendResult
 * - Lifecycle: Connect/disconnect, health monitoring
 * - Error Handling: Emit errors via 'adapter:error' event
 *
 * @see ADR-005 Addendum-2 - PlatformAdapter Interface
 * @see GPA-003 - Enhanced PlatformAdapter Interface
 */

import type { EventEmitter } from 'events';
import type {
  AdapterStatus,
  InboundMessageEvent,
  OutboundMessagePayload,
  Platform,
  SendResult,
} from '../../types/gateway.types';

/**
 * Platform Type
 *
 * Supported platform types for adapters.
 * Extends the base Platform type with future platform support.
 */
export type PlatformType = Platform | 'whatsapp' | 'wechat' | 'meta' | 'x' | 'slack' | 'email';

/**
 * Adapter Capabilities
 *
 * Defines what features a platform adapter supports.
 * Used for capability-based feature detection.
 */
export type AdapterCapability =
  // Basic messaging
  | 'send_text'
  | 'send_attachments'
  | 'receive_text'
  | 'receive_attachments'
  // Message operations
  | 'delete_message'
  | 'update_message'
  // Presence & indicators
  | 'typing_indicator'
  | 'read_receipts'
  | 'presence'
  // Message features
  | 'reactions'
  | 'threads'
  | 'mentions';

/**
 * Base Adapter Configuration
 *
 * Shared configuration interface for all adapters.
 * Platform-specific adapters extend this with additional fields.
 */
export type BaseAdapterConfig = {
  /** Unique identifier (UUID from database) */
  id: string;
  /** Human-readable name (e.g., "Main Telegram") */
  name: string;
  /** Unique identifier key (e.g., "telegram-main") */
  key: string;
  /** Platform type */
  type: PlatformType;
  /** Is this adapter enabled? */
  enabled: boolean;
  /** Platform-specific credentials (encrypted) */
  credentials?: Record<string, unknown>;
};

/**
 * Adapter Metadata
 *
 * Static metadata about an adapter, provided at creation time.
 * Used for capability detection and display purposes.
 */
export type AdapterMetadata = {
  /** Platform type */
  platform: PlatformType;
  /** Human-readable display name (e.g., "Telegram", "IRC") */
  displayName: string;
  /** Adapter version string (e.g., "1.0.0") */
  version: string;
  /** List of capabilities this adapter supports */
  capabilities: AdapterCapability[];
};

/**
 * Health Check Result (Enhanced)
 *
 * Result from adapter health check with detailed status.
 */
export type HealthCheckResultEnhanced = {
  /** Health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Timestamp of last check */
  lastCheck: Date;
  /** Additional details about the health status */
  details?: Record<string, unknown>;
};

/**
 * Platform Adapter Interface (Enhanced)
 *
 * All platform adapters must implement this interface.
 * Extends EventEmitter for event-driven architecture.
 *
 * @template TConfig - Adapter-specific configuration type
 */
export interface PlatformAdapter<TConfig extends BaseAdapterConfig = BaseAdapterConfig>
  extends EventEmitter {
  // ========================================
  // Metadata (read-only, provided at creation)
  // ========================================

  /** Adapter metadata (platform, displayName, version, capabilities) */
  readonly metadata: AdapterMetadata;

  /** Current adapter status */
  readonly status: AdapterStatus;

  // ========================================
  // Legacy property (for backward compatibility)
  // ========================================

  /** Platform identifier (deprecated: use metadata.platform) */
  readonly platform: Platform;

  // ========================================
  // Configuration
  // ========================================

  /**
   * Configure adapter with runtime configuration
   *
   * @param config - Configuration object
   * @returns true if configuration is valid, false otherwise
   */
  configure(config: TConfig): boolean;

  // ========================================
  // Lifecycle
  // ========================================

  /**
   * Connect to the platform
   *
   * Should:
   * - Set status to 'connecting'
   * - Establish connection to platform
   * - Set status to 'connected' on success
   * - Emit 'adapter:connected' event on success
   * - Emit 'adapter:error' event on failure
   *
   * @throws Error if connection fails
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the platform
   *
   * Should:
   * - Clean up resources
   * - Set status to 'disconnected'
   * - Emit 'adapter:disconnected' event
   */
  disconnect(): Promise<void>;

  /**
   * Check adapter health
   *
   * @returns Health check result
   */
  healthCheck(): Promise<HealthCheckResultEnhanced>;

  // ========================================
  // Messaging
  // ========================================

  /**
   * Send a message to the platform
   *
   * IMPORTANT: Must NOT throw errors. Return SendResult with success=false instead.
   *
   * @param message - Outbound message payload
   * @returns Send result indicating success or failure
   */
  send(message: OutboundMessagePayload): Promise<SendResult>;

  /**
   * Delete a message from the platform (optional)
   *
   * Only implemented for platforms that support message deletion.
   *
   * @param externalMessageId - Platform-specific message ID
   * @returns true if deleted successfully, false otherwise
   */
  deleteMessage?(externalMessageId: string): Promise<boolean>;

  /**
   * Update/edit a message on the platform (optional)
   *
   * Only implemented for platforms that support message editing.
   *
   * @param externalMessageId - Platform-specific message ID
   * @param newBody - New message body text
   * @returns true if updated successfully, false otherwise
   */
  updateMessage?(externalMessageId: string, newBody: string): Promise<boolean>;

  // ========================================
  // Events (emitted via EventEmitter)
  // ========================================

  // - 'message:inbound' → (event: InboundMessageEvent)
  // - 'adapter:connected' → void
  // - 'adapter:disconnected' → { reason: string }
  // - 'adapter:error' → (error: Error)
}

/**
 * Type for adapter event handlers
 */
export type AdapterEventHandlers = {
  'message:inbound': (event: InboundMessageEvent) => void;
  'adapter:connected': () => void;
  'adapter:disconnected': (event: { reason: string }) => void;
  'adapter:error': (error: Error) => void;
};
