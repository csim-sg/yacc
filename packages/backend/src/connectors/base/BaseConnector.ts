/**
 * IConnector - Base Interface for Platform Connectors
 *
 * Standard interface that all connectors (Telegram, IRC) must implement.
 * Ensures consistent behavior across different platforms.
 */

import { EventEmitter } from 'events';
import type { Platform } from '@yacc/common/types/Platform.type';
import type { ConnectorStatus } from '@yacc/common/types/ConnectorStatus.type';
import type { ConnectionInfo } from '@yacc/common/types/ConnectionInfo.interface';
import type { SendMessageRequest } from '@yacc/common/types/SendMessageRequest.interface';
import type { SendMessageResponse } from '@yacc/common/types/SendMessageResponse.interface';
import type { ConnectorEventMap } from '@yacc/common/types/ConnectorEventMap.type';
import type { ValidationError } from '@yacc/common/types/ValidationError.interface';
import type { ConnectorMessage } from '@yacc/common/types/ConnectorMessage.interface';
import type { MessageSendError } from '@yacc/common/types/MessageSendError.interface';
import type { ConnectorConfig } from '@yacc/common/types/ConnectorConfig.type';
import { MessageStatusTracker } from '../../services/MessageStatusTracker';

// ============================================
// Abstract Base Connector Class
// ============================================

/**
 * Abstract base class for all platform connectors.
 * Implements common functionality and enforces interface contract.
 */
export abstract class BaseConnector<
  T extends Platform = Platform,
  TConfig extends ConnectorConfig<T> = ConnectorConfig<T>,
  TEvents extends ConnectorEventMap = ConnectorEventMap
> extends EventEmitter {
  // ==========================================
  // Properties
  // ==========================================

  public readonly platform: T;
  protected config: TConfig | null;
  protected connectionStatus: ConnectorStatus = 'disconnected';
  protected reconnectAttempts: number = 0;
  protected maxReconnectAttempts: number = 10;
  protected reconnectBackoffMs: number[] = [1000, 2000, 4000, 8000, 16000, 30000];

  // ==========================================
  // Constructor
  // ==========================================

  constructor(platform: T) {
    super();
    this.platform = platform;
  }

  // ==========================================
  // Public Interface Methods (to be implemented by subclasses)
  // ==========================================

  /**
   * Connect to platform (abstract - must be implemented)
   */
  public abstract connect(): Promise<void>;

  /**
   * Disconnect from platform (abstract - must be implemented)
   */
  public abstract disconnect(): Promise<void>;

  /**
   * Send a message to platform (abstract - must be implemented)
   */
  public abstract sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;

  // ==========================================
  // Common Implementation
  // ==========================================

  /**
   * Get current connection status
   */
  public getConnectionStatus(): ConnectionInfo {
    return {
      status: this.connectionStatus,
      lastConnectedAt: this.getLastConnectedAt(),
      lastDisconnectedAt: this.getLastDisconnectedAt(),
      reconnectAttempts: this.reconnectAttempts,
      errorMessage: this.getErrorMessage(),
    };
  }

  /**
   * Check if connector is currently connected
   */
  public isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }

  /**
   * Validate configuration
   */
  public async validateConfig(config: TConfig): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Common validation
    if (!config) {
      errors.push({
        field: 'config',
        message: 'Configuration is required',
      });
      return errors;
    }

    // Platform-specific validation (to be implemented by subclasses)
    const platformErrors = await this.validatePlatformConfig(config);
    errors.push(...platformErrors);

    return errors;
  }

  /**
   * Set configuration
   */
  public setConfig(config: TConfig): void {
    this.config = config;
  }

  /**
   * Update connection status and emit event
   */
  protected setStatus(status: ConnectorStatus, errorMessage?: string): void {
    const oldStatus = this.connectionStatus;
    this.connectionStatus = status;

    this.emit('debug', {
      event: 'status_change',
      from: oldStatus,
      to: status,
      platform: this.platform,
    });

    // Emit status events
    switch (status) {
      case 'connected':
        this.emit('connected');
        this.emit('integration_connected', this.platform);
        break;
      case 'disconnected':
        this.emit('disconnected');
        this.emit('integration_disconnected', this.platform);
        break;
      case 'reconnecting':
        this.emit('reconnecting', this.reconnectAttempts);
        break;
      case 'failed':
        this.emit('reconnect_failed');
        break;
    }

    if (errorMessage) {
      this.emit('debug', {
        event: 'error',
        status,
        errorMessage,
        platform: this.platform,
      });
    }
  }

  /**
   * Get last connected timestamp
   */
  protected getLastConnectedAt(): Date | undefined {
    return (this as any)._lastConnectedAt;
  }

  /**
   * Get last disconnected timestamp
   */
  protected getLastDisconnectedAt(): Date | undefined {
    return (this as any)._lastDisconnectedAt;
  }

  /**
   * Get error message
   */
  protected getErrorMessage(): string | undefined {
    return (this as any)._errorMessage;
  }

  /**
   * Set last connected timestamp
   */
  protected setLastConnectedAt(timestamp: Date): void {
    (this as any)._lastConnectedAt = timestamp;
  }

  /**
   * Set last disconnected timestamp
   */
  protected setLastDisconnectedAt(timestamp: Date): void {
    (this as any)._lastDisconnectedAt = timestamp;
  }

  /**
   * Set error message
   */
  protected setErrorMessage(message: string): void {
    (this as any)._errorMessage = message;
  }

  // ==========================================
  // Abstract Methods (to be implemented by subclasses)
  // ==========================================

  /**
   * Validate platform-specific configuration
   */
  protected abstract validatePlatformConfig(config: TConfig): Promise<ValidationError[]>;

  /**
   * Clean up resources
   */
  public async destroy(): Promise<void> {
    this.removeAllListeners();
    this.config = null;
    this.connectionStatus = 'disconnected';
    this.reconnectAttempts = 0;
  }

  // ==========================================
  // Message Status Tracking Methods
  // ==========================================

  /**
   * Emit message received event
   */
  protected emitMessageReceived(message: ConnectorMessage, dbMessageId: string): void {
    this.emit('message_received', message);

    // Track message status and persist to database
    MessageStatusTracker.trackReceivedMessage({
      messageId: dbMessageId,
      conversationId: '', // Will be set by connector
      status: 'pending',
      platform: this.platform,
      timestamp: new Date(),
    });
  }

  /**
   * Emit message sent event
   */
  protected emitMessageSent(response: SendMessageResponse, dbMessageId: string): void {
    this.emit('message_sent', response);

    // Track message status and persist to database
    if (response.success) {
      MessageStatusTracker.trackSentMessage({
        messageId: dbMessageId,
        conversationId: '', // Will be set by connector
        status: 'sent',
        platform: this.platform,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Emit message failed event
   */
  protected emitMessageFailed(error: MessageSendError, dbMessageId: string): void {
    this.emit('message_failed', {
      messageId: error.messageId || 'unknown',
      error,
    });

    // Track message failure and queue for retry
    MessageStatusTracker.trackFailedMessage({
      messageId: dbMessageId,
      conversationId: '', // Will be set by connector
      status: 'failed',
      platform: this.platform,
      timestamp: new Date(),
      error: error.message,
    });
  }

  // ==========================================
  // Utility: Validate required fields
  // ==========================================

  /**
   * Validate that a field is not empty
   */
  protected validateRequired(
    config: TConfig,
    fields: (keyof TConfig)[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const field of fields) {
      const value = config[field];
      if (!value || (typeof value === 'string' && !value.trim())) {
        errors.push({
          field: field as string,
          message: `${field} is required`,
        });
      }
    }

    return errors;
  }

  /**
   * Validate URL format
   */
  protected validateUrl(config: TConfig, field: keyof TConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    if (config[field]) {
      try {
        new URL(config[field] as string);
      } catch {
        errors.push({
          field: field as string,
          message: `${field} must be a valid URL`,
        });
      }
    }

    return errors;
  }
}

// ============================================
// Export
// ============================================

export { BaseConnector };
