import { randomUUID } from 'crypto';
import { BaseConnector } from './base/baseConnector';
import { logger } from '../infrastructure/logger';
import type { SendMessageRequest } from '@yacc/common/types/sendMessageRequest.interface';
import type { SendMessageResponse } from '@yacc/common/types/sendMessageResponse.interface';
import type { ValidationError } from '@yacc/common/types/validationError.interface';
import type { ConnectorConfig } from '@yacc/common/types/connectorConfig.type';
import { Client as IRCClient } from 'irc-framework';
import type { IRCMessageEvent, IRCErrorEvent } from 'irc-framework';
import { ircIngestionService } from '../services/irc-ingestion.service';

/**
 * IRC Connector
 *
 * Handles all communication with IRC networks using irc-framework library.
 * Supports:
 * - Real IRC server connections with proper handshake
 * - Sending and receiving messages
 * - Channel management
 * - Event-driven reconnection with exponential backoff
 */

type IRCConfig = ConnectorConfig<'irc'> & {
  server: string;
  port: number;
  nick: string;
  password?: string;
  channels: string[];
};

const CONNECT_TIMEOUT_MS = 30000;
const MAX_MESSAGE_LENGTH = 400; // IRC limit is 512 total, leave room for protocol overhead

/**
 * Sanitize message for IRC transmission
 * Prevents CRLF injection and excessive length
 */
function sanitizeMessage(message: string): string {
  // Remove CRLF characters that could break IRC protocol
  let sanitized = message.replace(/[\r\n]/g, ' ');
  
  // Truncate if too long
  if (sanitized.length > MAX_MESSAGE_LENGTH) {
    sanitized = sanitized.substring(0, MAX_MESSAGE_LENGTH);
  }
  
  return sanitized;
}

export class IRCConnector extends BaseConnector<'irc', IRCConfig> {
  private client: IRCClient | null = null;
  private isConnecting: boolean = false;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private connectTimeoutId: NodeJS.Timeout | null = null;
  private correlationId: string = '';
  private reconnectIncidentId: string = '';

  constructor() {
    super('irc');
    // Override max reconnect attempts for IRC: EA spec requires exactly 5 attempts
    this.maxReconnectAttempts = 5;
  }

  /**
   * Connect to IRC server with proper handshake
   * Waits for 'registered' event (connection complete)
   * or times out/fails on error/close events
   */
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not set. Call setConfig first.');
    }

    // Generate correlation ID for this connection attempt
    this.correlationId = randomUUID();
    
    // Initialize reconnect incident ID on first attempt (startup or after manual disconnect)
    // This ID tracks the entire reconnect series (1-5 attempts)
    if (this.reconnectAttempts === 0) {
      this.reconnectIncidentId = randomUUID();
    }

    if (this.isConnecting) {
      logger.warn(
        {
          platform: 'irc',
          correlationId: this.correlationId,
          reconnectIncidentId: this.reconnectIncidentId,
          attempt: this.reconnectAttempts,
        },
        'Connection already in progress'
      );
      return;
    }

    this.isConnecting = true;
    this.setStatus('reconnecting');

    logger.info(
      {
        platform: 'irc',
        correlationId: this.correlationId,
        reconnectIncidentId: this.reconnectIncidentId,
        server: this.config.server,
        port: this.config.port,
        nick: this.config.nick,
      },
      'Connecting to IRC server...'
    );

    try {
      // Validate connection parameters first
      const validationErrors = await this.validatePlatformConfig(this.config);
      if (validationErrors.length > 0) {
        throw new Error(`IRC validation error: ${validationErrors[0].message}`);
      }

      // Create IRC client instance
      this.client = new IRCClient();

      // Set up event handlers BEFORE performing handshake
      // This ensures message events and mid-connection errors are properly handled
      this.setupClientEventHandlers();

      // Implement handshake with proper Promise wrapping
      // connect() is synchronous but we need to wait for 'registered' event
      await this.performHandshake();

      this.isConnecting = false;
      
      // Reset attempts on successful connection (per spec)
      const previousAttempts = this.reconnectAttempts;
      this.reconnectAttempts = 0;
      
      logger.info(
        {
          platform: 'irc',
          correlationId: this.correlationId,
          reconnectIncidentId: this.reconnectIncidentId,
          server: this.config.server,
          channels: this.config.channels,
          attemptsUsed: previousAttempts,
        },
        'Successfully connected to IRC server'
      );
    } catch (error) {
      this.isConnecting = false;
      const errorReason = this.sanitizeErrorReason(error);
      this.setStatus('disconnected', errorReason);

      logger.error(
        {
          error: errorReason,
          platform: 'irc',
          correlationId: this.correlationId,
          reconnectIncidentId: this.reconnectIncidentId,
          attempt: this.reconnectAttempts,
          maxAttempts: this.maxReconnectAttempts,
          server: this.config?.server,
        },
        'Failed to connect to IRC server, scheduling reconnection'
      );

      // Schedule reconnection with exponential backoff
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Perform IRC handshake: wait for 'registered' event
   * Returns a Promise that resolves on 'registered' or rejects on error/close/timeout
   */
  private performHandshake(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        return reject(new Error('IRC client not initialized'));
      }

      const client = this.client;
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Connection timeout: did not receive registered event'));
      }, CONNECT_TIMEOUT_MS);

      const cleanup = () => {
        clearTimeout(timeout);
        client.removeListener('registered', onRegistered);
        client.removeListener('error', onError);
        client.removeListener('close', onClose);
        client.removeListener('socket close', onSocketClose);
      };

      const onRegistered = () => {
        logger.debug(
          { platform: 'irc', correlationId: this.correlationId },
          'IRC registered event received'
        );
        cleanup();
        
        // Set status to connected BEFORE joining channels
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        
        // Join channels after successful registration
        if (this.config?.channels) {
          for (const channel of this.config.channels) {
            logger.debug(
              { platform: 'irc', correlationId: this.correlationId, channel },
              'Joining IRC channel'
            );
            client.join(channel);
          }
        }
        resolve();
      };

      const onError = (error: IRCErrorEvent) => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            error: errorMsg,
            platform: 'irc',
            correlationId: this.correlationId,
          },
          'IRC client error during handshake'
        );
        cleanup();
        reject(error);
      };

      const onClose = () => {
        logger.warn(
          { platform: 'irc', correlationId: this.correlationId },
          'IRC connection closed during handshake'
        );
        cleanup();
        reject(new Error('Connection closed by server'));
      };

      const onSocketClose = () => {
        logger.warn(
          { platform: 'irc', correlationId: this.correlationId },
          'IRC socket closed during handshake'
        );
        cleanup();
        reject(new Error('Socket closed'));
      };

      // Register handlers for connection lifecycle
      client.on('registered', onRegistered);
      client.on('error', onError);
      client.on('close', onClose);
      client.on('socket close', onSocketClose);

      // Now initiate the actual connection
      // Note: connect() is synchronous and returns undefined
      try {
        const config = this.config;
        if (!config) {
          cleanup();
          return reject(new Error('Configuration lost'));
        }
        client.connect({
          host: config.server,
          port: config.port,
          nick: config.nick,
          username: config.nick,
          gecos: config.nick,
          password: config.password,
          auto_reconnect: false, // We manage reconnect ourselves
          ping_interval: 60,
        });
      } catch (connectError) {
        cleanup();
        reject(connectError);
      }
    });
  }

  /**
   * Calculate exponential backoff delay in milliseconds
   * Formula: delayMs = min(60000, 1000 * 2^(attempt-1))
   * Maps to: 1s, 2s, 4s, 8s, 16s (capped at 60s)
   *
   * @param attemptNumber - 1-based attempt number (1, 2, 3, 4, 5)
   * @returns delay in milliseconds
   */
  private calculateBackoffMs(attemptNumber: number): number {
    const baseDelayMs = 1000; // 1 second base
    const exponentialDelayMs = baseDelayMs * Math.pow(2, attemptNumber - 1);
    return Math.min(60000, exponentialDelayMs); // Cap at 60 seconds
  }

  /**
   * Sanitize error message for logging (remove sensitive info)
   */
  private sanitizeErrorReason(error: unknown): string {
    if (error instanceof Error) {
      // Remove potential stack traces and keep just the message
      return error.message.split('\n')[0];
    }
    const str = String(error);
    return str.substring(0, 200); // Cap length to prevent spam
  }

  /**
   * Schedule reconnection with exponential backoff
   * Implements EA-approved spec: 5 attempts, 1s→16s backoff, capped at 60s
   * Guards against multiple parallel reconnect timeouts
   */
  private scheduleReconnect(): void {
    // Guard: don't schedule if already scheduled
    if (this.reconnectTimeoutId) {
      logger.debug(
        {
          platform: 'irc',
          correlationId: this.correlationId,
          reconnectIncidentId: this.reconnectIncidentId,
          attempt: this.reconnectAttempts,
        },
        'Reconnect already scheduled, ignoring duplicate request'
      );
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(
        {
          platform: 'irc',
          correlationId: this.correlationId,
          reconnectIncidentId: this.reconnectIncidentId,
          attempt: this.reconnectAttempts,
          maxAttempts: this.maxReconnectAttempts,
        },
        'Max reconnection attempts reached, marking as failed'
      );
      this.setStatus('failed');
      return;
    }

    // Increment attempt counter (1-based for formula)
    this.reconnectAttempts++;
    const delayMs = this.calculateBackoffMs(this.reconnectAttempts);

    logger.info(
      {
        platform: 'irc',
        correlationId: this.correlationId,
        reconnectIncidentId: this.reconnectIncidentId,
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
        delayMs,
        server: this.config?.server,
      },
      'Scheduling IRC reconnection attempt'
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connect().catch((err) => {
        const errMsg = this.sanitizeErrorReason(err);
        logger.error(
          {
            platform: 'irc',
            correlationId: this.correlationId,
            reconnectIncidentId: this.reconnectIncidentId,
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            error: errMsg,
            delayMs,
          },
          'Error during scheduled reconnection attempt'
        );
      });
    }, delayMs);
  }

  /**
   * Set up IRC client event handlers for message events
   * Note: Connection lifecycle is handled in performHandshake()
   */
  private setupClientEventHandlers(): void {
    if (!this.client) return;

    const client = this.client;

    // Handle incoming messages
    client.on('message', (evt: IRCMessageEvent) => {
      logger.debug(
        {
          platform: 'irc',
          correlationId: this.correlationId,
          nick: evt.nick,
          channel: evt.target,
          messageLength: evt.message.length,
        },
        'Received IRC message'
      );

      // Process inbound message via ingestion service (async, non-blocking)
      if (this.config) {
        ircIngestionService.ingestInboundMessage({
          channel: evt.target,
          nick: evt.nick,
          message: evt.message,
          connectorNick: this.config.nick,
        }).catch((error) => {
          logger.error(
            {
              platform: 'irc',
              nick: evt.nick,
              channel: evt.target,
              error: error instanceof Error ? error.message : String(error),
            },
            'Error ingesting IRC message'
          );
          // Don't rethrow - ingestion errors shouldn't break connector
        });
      }

      this.emit('message', evt);
    });

    // Handle mid-connection errors (not connection errors which are handled in handshake)
    client.on('error', (error: IRCErrorEvent) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          error: errorMessage,
          platform: 'irc',
          correlationId: this.correlationId,
        },
        'IRC client error'
      );
      this.setStatus('error', errorMessage);
      // Trigger reconnect for errors after successful connection
      if (this.connectionStatus === 'connected') {
        this.setStatus('disconnected');
        this.scheduleReconnect();
      }
    });

    // Handle socket close (disconnection during operation)
    client.on('socket close', () => {
      logger.warn(
        { platform: 'irc', correlationId: this.correlationId },
        'IRC socket closed'
      );
      this.setStatus('disconnected');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    // Handle connection closure (disconnection during operation)
    client.on('close', () => {
      logger.info(
        { platform: 'irc', correlationId: this.correlationId },
        'IRC connection closed'
      );
      this.setStatus('disconnected');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    });

    // Handle quit event
    client.on('quit', (evt: IRCMessageEvent) => {
      logger.info(
        {
          platform: 'irc',
          correlationId: this.correlationId,
          nick: evt.nick,
          message: evt.message,
        },
        'IRC user quit'
      );
    });

    // Handle join event
    client.on('join', (evt: IRCMessageEvent) => {
      logger.debug(
        {
          platform: 'irc',
          correlationId: this.correlationId,
          nick: evt.nick,
          channel: evt.target,
        },
        'User joined IRC channel'
      );
    });

    // Handle part event
    client.on('part', (evt: IRCMessageEvent) => {
      logger.debug(
        {
          platform: 'irc',
          correlationId: this.correlationId,
          nick: evt.nick,
          channel: evt.target,
        },
        'User left IRC channel'
      );
    });
  }

  /**
   * Disconnect from IRC server
   * Clears all pending timers and resets reconnect state
   */
  async disconnect(): Promise<void> {
    logger.info(
      { platform: 'irc', correlationId: this.reconnectIncidentId },
      'Disconnecting from IRC server'
    );

    // Clear pending reconnect timeout if any (manual disconnect stops retry loop)
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
      logger.debug(
        { platform: 'irc', correlationId: this.reconnectIncidentId },
        'Cleared pending reconnect timeout'
      );
    }

    // Clear pending connect timeout if any
    if (this.connectTimeoutId) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }

    if (this.client) {
      this.client.quit('YACC shutting down');
      this.client = null;
    }

    this.reconnectAttempts = 0; // Reset attempts on manual disconnect
    this.setStatus('disconnected');
    await this.destroy();

    logger.info(
      { platform: 'irc', correlationId: this.reconnectIncidentId },
      'Successfully disconnected from IRC'
    );
  }

  /**
   * Send message to IRC channel
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    // Use request correlationId for tracing if provided, otherwise generate one for this send attempt
    const traceCorrelationId = request.correlationId || randomUUID();

    try {
      if (!this.config) {
        throw new Error('Configuration not set');
      }

      // Extract channel from recipient ID (format: irc:#channel or #channel)
      const channel = this.extractChannel(request.recipientId);
      if (!channel) {
        throw new Error(`Invalid IRC channel format: ${request.recipientId}`);
      }

      logger.debug(
        {
          conversationId: request.conversationId,
          messageId: request.messageId,
          channel,
          platform: 'irc',
          correlationId: traceCorrelationId,
        },
        'Sending message to IRC channel'
      );

      // If not connected, fail fast - BullMQ is the only retry mechanism for outbound delivery
      // This prevents double-send risk from internal connector queue + BullMQ retry queue
      if (!this.isConnected()) {
        const errorMsg = 'IRC not connected. Message will be retried via BullMQ.';
        logger.warn(
          {
            conversationId: request.conversationId,
            messageId: request.messageId,
            channel,
            platform: 'irc',
            correlationId: traceCorrelationId,
            connectionStatus: this.connectionStatus,
          },
          errorMsg
        );
        return {
          success: false,
          error: errorMsg,
          sentAt: new Date().toISOString(),
        };
      }

      // Send message using IRC client
      if (!this.client) {
        throw new Error('IRC client not initialized');
      }

      // Sanitize message to prevent CRLF injection and length violations
      const sanitizedMessage = sanitizeMessage(request.body);
      
      // Use say() instead of raw() for safer message transmission
      // say() handles the IRC protocol details and prevents injection
      this.client.say(channel, sanitizedMessage);

      const platformMessageId = `irc-${Date.now()}`;

      logger.info(
        {
          conversationId: request.conversationId,
          messageId: request.messageId,
          channel,
          platformMessageId,
          platform: 'irc',
          correlationId: traceCorrelationId,
        },
        'Message sent successfully to IRC channel'
      );

      return {
        success: true,
        platformMessageId,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        {
          error: errorMessage,
          conversationId: request.conversationId,
          messageId: request.messageId,
          platform: 'irc',
          correlationId: traceCorrelationId,
        },
        'Error sending message to IRC'
      );

      return {
        success: false,
        error: errorMessage,
        sentAt: new Date().toISOString(),
      };
    }
  }

  private isConnected(): boolean {
    return this.connectionStatus === 'connected';
  }

  /**
   * Validate IRC-specific configuration
   */
  protected async validatePlatformConfig(config: IRCConfig): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Validate required fields
    const requiredErrors = this.validateRequired(config, ['server', 'nick']);
    errors.push(...requiredErrors);

    // Validate port
    if (config.port) {
      if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
        errors.push({
          field: 'port',
          message: 'Port must be a number between 1 and 65535',
        });
      }
    } else {
      errors.push({
        field: 'port',
        message: 'Port is required',
      });
    }

    // Validate channels
    if (!config.channels || !Array.isArray(config.channels) || config.channels.length === 0) {
      errors.push({
        field: 'channels',
        message: 'At least one channel is required',
      });
    } else {
      // Validate channel format
      for (const channel of config.channels) {
        if (typeof channel !== 'string' || !channel.startsWith('#')) {
          errors.push({
            field: 'channels',
            message: `Invalid channel format: ${channel}. Channels must start with #`,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Extract channel from recipient ID
   * Format: irc:#channel or #channel
   */
  private extractChannel(recipientId: string): string | null {
    if (recipientId.startsWith('irc:')) {
      const channel = recipientId.substring('irc:'.length);
      return channel.startsWith('#') ? channel : null;
    }
    // If it starts with #, use it directly
    if (recipientId.startsWith('#')) {
      return recipientId;
    }
    return null;
  }

}
