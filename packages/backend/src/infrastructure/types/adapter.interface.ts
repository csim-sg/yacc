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
 */

import { EventEmitter } from 'events';
import type {
  AdapterStatus,
  HealthCheckResult,
  InboundMessageEvent,
  OutboundMessagePayload,
  Platform,
  SendResult,
} from '../../types/gateway.types';

/**
 * Platform Adapter Interface
 *
 * All platform adapters must implement this interface.
 * Extends EventEmitter for event-driven architecture.
 */
export interface PlatformAdapter extends EventEmitter {
  /** Platform identifier */
  readonly platform: Platform;

  /** Current adapter status */
  readonly status: AdapterStatus;

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
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Send a message to the platform
   *
   * IMPORTANT: Must NOT throw errors. Return SendResult with success=false instead.
   *
   * @param message - Outbound message payload
   * @returns Send result indicating success or failure
   */
  send(message: OutboundMessagePayload): Promise<SendResult>;

  // Events emitted (via EventEmitter):
  // - 'message:inbound' → (event: InboundMessageEvent)
  // - 'adapter:connected' → void
  // - 'adapter:disconnected' → { reason: string }
  // - 'adapter:error' → (error: Error)
}

/**
 * Type for adapter event handlers
 */
export interface AdapterEventHandlers {
  'message:inbound': (event: InboundMessageEvent) => void;
  'adapter:connected': () => void;
  'adapter:disconnected': (event: { reason: string }) => void;
  'adapter:error': (error: Error) => void;
}
