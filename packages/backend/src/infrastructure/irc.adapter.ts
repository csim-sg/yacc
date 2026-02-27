/**
 * IRC Adapter
 *
 * Platform adapter for IRC network integration.
 * Implements PlatformAdapter interface for unified message handling.
 *
 * Responsibilities:
 * - Connect to IRC servers with proper handshake
 * - Emit inbound messages as InboundMessageEvent
 * - Send outbound messages to IRC channels
 * - Handle reconnection with exponential backoff
 *
 * @see ADR-005 Addendum-2 - PlatformAdapter Interface
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import { Client as IRCClient, type IRCMessageEvent, type IRCErrorEvent } from 'irc-framework';
import { logger } from '../infrastructure/logger';
import type {
  AdapterStatus,
  HealthCheckResult,
  InboundMessageEvent,
  OutboundMessagePayload,
  SendResult,
} from '../types/gateway.types';
import type {
  AdapterMetadata,
  BaseAdapterConfig,
  PlatformAdapter,
} from './types/adapter.interface';

/**
 * IRC Adapter Configuration
 */
export interface IRCAdapterConfig {
  server: string;
  port: number;
  nick: string;
  password?: string;
  channels: string[];
  profileId?: number;
}

type IRCRuntimeConfig = BaseAdapterConfig & {
  credentials?: {
    server?: string;
    port?: number;
    nick?: string;
    password?: string;
    channels?: string[];
  };
};

/**
 * Connection timeout in milliseconds
 */
const CONNECT_TIMEOUT_MS = 30000;

/**
 * Maximum IRC message length (512 total, leave room for protocol overhead)
 */
const MAX_MESSAGE_LENGTH = 400;

/**
 * IRC Adapter
 *
 * Implements PlatformAdapter for IRC networks.
 */
export class IRCAdapter extends EventEmitter implements PlatformAdapter<IRCRuntimeConfig> {
  readonly platform = 'irc';
  status: AdapterStatus = 'disconnected';

  /**
   * Adapter metadata for capability detection
   */
  readonly metadata: AdapterMetadata = {
    platform: 'irc',
    displayName: 'IRC',
    version: '1.0.0',
    capabilities: [
      'send_text',
      'receive_text',
      'presence',
      'typing_indicator',
    ],
  };

  private client: IRCClient | null = null;
  private config: IRCAdapterConfig | null = null;
  private isConnecting = false;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private correlationId = '';
  private reconnectIncidentId = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private lastMessageAt: Date | null = null;
  private profileId?: number;

  /**
   * Set adapter configuration
   */
  setConfig(config: IRCAdapterConfig): void {
    this.config = config;
    this.profileId = config.profileId;
  }

  /**
   * Configure adapter with runtime configuration (PlatformAdapter interface)
   *
   * @param config - Configuration object (uses BaseAdapterConfig structure)
   * @returns true if configuration is valid
   */
  configure(config: IRCRuntimeConfig): boolean {
    const creds = config.credentials;
    if (!creds?.server || !creds?.nick) {
      return false;
    }
    this.config = {
      server: creds.server,
      port: creds.port ?? 6667,
      nick: creds.nick,
      password: creds.password,
      channels: creds.channels ?? [],
    };
    return true;
  }

  /**
   * Connect to IRC server
   */
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not set. Call setConfig first.');
    }

    this.correlationId = randomUUID();

    if (this.isConnecting) {
      logger.warn(
        { platform: 'irc', correlationId: this.correlationId },
        'Connection already in progress'
      );
      return;
    }

    this.isConnecting = true;
    this.status = 'connecting';

    logger.info(
      {
        platform: 'irc',
        correlationId: this.correlationId,
        server: this.config.server,
        port: this.config.port,
        nick: this.config.nick,
      },
      'Connecting to IRC server'
    );

    try {
      this.client = new IRCClient();
      this.setupClientEventHandlers();
      await this.performHandshake();

      this.isConnecting = false;
      this.reconnectAttempts = 0;

      logger.info(
        {
          platform: 'irc',
          correlationId: this.correlationId,
          server: this.config.server,
          channels: this.config.channels,
        },
        'Successfully connected to IRC server'
      );
    } catch (error) {
      this.isConnecting = false;
      const errorReason = this.sanitizeErrorReason(error);
      this.status = 'error';

      logger.error(
        {
          error: errorReason,
          platform: 'irc',
          correlationId: this.correlationId,
          server: this.config?.server,
        },
        'Failed to connect to IRC server'
      );

      this.emit('adapter:error', new Error(errorReason));
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Disconnect from IRC server
   */
  async disconnect(): Promise<void> {
    logger.info(
      { platform: 'irc', correlationId: this.correlationId },
      'Disconnecting from IRC server'
    );

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.client) {
      this.client.quit('YACC adapter shutting down');
      this.client = null;
    }

    this.reconnectAttempts = 0;
    this.status = 'disconnected';
    this.emit('adapter:disconnected', { reason: 'manual' });
  }

  /**
   * Check adapter health
   */
  async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: this.status === 'connected',
      details: this.status !== 'connected' ? `Status: ${this.status}` : undefined,
      lastMessageAt: this.lastMessageAt || undefined,
    };
  }

  /**
   * Send message to IRC channel
   */
  async send(message: OutboundMessagePayload): Promise<SendResult> {
    const traceCorrelationId = message.correlationId || randomUUID();

    try {
      if (!this.config) {
        return {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Configuration not set',
            retryable: false,
          },
          timestamp: new Date(),
        };
      }

      if (this.status !== 'connected' || !this.client) {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: 'IRC not connected',
            retryable: true,
          },
          timestamp: new Date(),
        };
      }

      // Extract channel from conversation ID or metadata
      const channel = this.extractChannel(message);
      if (!channel) {
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: 'Invalid IRC channel format',
            retryable: false,
          },
          timestamp: new Date(),
        };
      }

      // Sanitize message to prevent CRLF injection
      const sanitizedMessage = this.sanitizeMessage(message.body);

      this.client.say(channel, sanitizedMessage);

      const platformMessageId = `irc-${Date.now()}`;

      logger.info(
        {
          conversationId: message.conversationId,
          channel,
          platformMessageId,
          platform: 'irc',
          correlationId: traceCorrelationId,
        },
        'Message sent successfully to IRC channel'
      );

      return {
        success: true,
        externalMessageId: platformMessageId,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        {
          error: errorMessage,
          conversationId: message.conversationId,
          platform: 'irc',
          correlationId: traceCorrelationId,
        },
        'Error sending message to IRC'
      );

      return {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
          message: errorMessage,
          retryable: true,
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Perform IRC handshake
   */
  private performHandshake(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.config) {
        return reject(new Error('IRC client not initialized'));
      }

      const client = this.client;
      const config = this.config;
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Connection timeout'));
      }, CONNECT_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timeout);
        client.removeListener('registered', onRegistered);
        client.removeListener('error', onError);
        client.removeListener('close', onClose);
        client.removeListener('socket close', onSocketClose);
      };

      const onRegistered = () => {
        cleanup();
        this.status = 'connected';
        this.reconnectAttempts = 0;
        this.emit('adapter:connected');

        // Join channels
        if (config.channels) {
          for (const channel of config.channels) {
            client.join(channel);
          }
        }

        resolve();
      };

      const onError = (error: IRCErrorEvent) => {
        cleanup();
        this.status = 'error';
        this.emit('adapter:error', new Error(String(error)));
        reject(error);
      };

      const onClose = () => {
        cleanup();
        reject(new Error('Connection closed by server'));
      };

      const onSocketClose = () => {
        cleanup();
        reject(new Error('Socket closed'));
      };

      client.on('registered', onRegistered);
      client.on('error', onError);
      client.on('close', onClose);
      client.on('socket close', onSocketClose);

      client.connect({
        host: config.server,
        port: config.port,
        nick: config.nick,
        username: config.nick,
        gecos: config.nick,
        password: config.password,
        auto_reconnect: false,
        ping_interval: 60,
      });
    });
  }

  /**
   * Set up IRC client event handlers
   */
  private setupClientEventHandlers(): void {
    if (!this.client) return;

    const client = this.client;

    // Handle incoming messages
    client.on('message', (evt: IRCMessageEvent) => {
      this.lastMessageAt = new Date();

      // Skip self-echo
      if (evt.nick.toLowerCase() === this.config?.nick.toLowerCase()) {
        return;
      }

      // Only handle channel messages (not DMs for MVP)
      if (!this.isChannel(evt.target)) {
        return;
      }

      // Emit inbound message event
      const inboundEvent: InboundMessageEvent = {
        platform: 'irc',
        externalThreadId: evt.target,
        sender: {
          externalUserId: evt.nick,
          displayName: evt.nick,
        },
        body: evt.message,
        receivedAt: new Date(),
        rawPayload: evt,
        correlationId: randomUUID(),
        ircProfileId: this.profileId,
      };

      this.emit('message:inbound', inboundEvent);
    });

    // Handle errors after connection
    client.on('error', (error: IRCErrorEvent) => {
      logger.error(
        { error: String(error), platform: 'irc' },
        'IRC client error'
      );
      this.emit('adapter:error', new Error(String(error)));

      if (this.status === 'connected') {
        this.status = 'disconnected';
        this.emit('adapter:disconnected', { reason: String(error) });
        this.scheduleReconnect();
      }
    });

    // Handle socket close
    client.on('socket close', () => {
      logger.warn({ platform: 'irc' }, 'IRC socket closed');
      if (this.status === 'connected') {
        this.status = 'disconnected';
        this.emit('adapter:disconnected', { reason: 'socket close' });
        this.scheduleReconnect();
      }
    });

    // Handle connection close
    client.on('close', () => {
      logger.info({ platform: 'irc' }, 'IRC connection closed');
      if (this.status === 'connected') {
        this.status = 'disconnected';
        this.emit('adapter:disconnected', { reason: 'connection closed' });
        this.scheduleReconnect();
      }
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(
        { platform: 'irc', attempts: this.reconnectAttempts },
        'Max reconnection attempts reached'
      );
      this.status = 'error';
      this.emit('adapter:error', new Error('Max reconnection attempts reached'));
      return;
    }

    if (this.reconnectAttempts === 0) {
      this.reconnectIncidentId = randomUUID();
    }

    this.reconnectAttempts++;
    const delayMs = Math.min(60000, 1000 * Math.pow(2, this.reconnectAttempts - 1));

    logger.info(
      {
        platform: 'irc',
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        delayMs,
      },
      'Scheduling IRC reconnection'
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connect().catch((err) => {
        logger.error(
          { error: this.sanitizeErrorReason(err), platform: 'irc' },
          'Reconnection attempt failed'
        );
      });
    }, delayMs);
  }

  /**
   * Sanitize error message
   */
  private sanitizeErrorReason(error: unknown): string {
    if (error instanceof Error) {
      return error.message.split('\n')[0];
    }
    return String(error).substring(0, 200);
  }

  /**
   * Sanitize message for IRC
   */
  private sanitizeMessage(message: string): string {
    let sanitized = message.replace(/[\r\n]/g, ' ');
    if (sanitized.length > MAX_MESSAGE_LENGTH) {
      sanitized = sanitized.substring(0, MAX_MESSAGE_LENGTH);
    }
    return sanitized;
  }

  /**
   * Check if target is a channel
   */
  private isChannel(target: string): boolean {
    return target.startsWith('#') || target.startsWith('&');
  }

  /**
   * Extract channel from message
   */
  private extractChannel(message: OutboundMessagePayload): string | null {
    // For now, use metadata or conversation external thread ID
    // This will be enhanced when wired with conversation service
    const recipientId = message.metadata?.recipientId as string | undefined;
    if (recipientId) {
      if (recipientId.startsWith('irc:')) {
        const channel = recipientId.substring('irc:'.length);
        return channel.startsWith('#') ? channel : null;
      }
      if (recipientId.startsWith('#')) {
        return recipientId;
      }
    }
    return null;
  }
}

/**
 * Factory function to create IRC adapter
 */
export function createIRCAdapter(): IRCAdapter {
  return new IRCAdapter();
}
