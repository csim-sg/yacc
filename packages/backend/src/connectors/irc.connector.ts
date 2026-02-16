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
 * - Message queue with capacity limits
 */

type IRCConfig = ConnectorConfig<'irc'> & {
  server: string;
  port: number;
  nick: string;
  password?: string;
  channels: string[];
};

// Message queue with hard capacity limit
interface QueuedMessage {
  channel: string;
  message: string;
}

const MESSAGE_QUEUE_MAX_SIZE = 1000;
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
  private messageQueue: QueuedMessage[] = [];
  private isConnecting: boolean = false;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private connectTimeoutId: NodeJS.Timeout | null = null;
  private correlationId: string = '';

  constructor() {
    super('irc');
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

    if (this.isConnecting) {
      logger.warn(
        { platform: 'irc', correlationId: this.correlationId },
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
      logger.info(
        {
          platform: 'irc',
          correlationId: this.correlationId,
          server: this.config.server,
          channels: this.config.channels,
        },
        'Successfully connected to IRC server'
      );

      // Process any queued messages
      await this.processMessageQueue();
    } catch (error) {
      this.isConnecting = false;
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.setStatus('disconnected', errorMessage);

      logger.error(
        {
          error: errorMessage,
          platform: 'irc',
          correlationId: this.correlationId,
          server: this.config?.server,
        },
        'Failed to connect to IRC server'
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
   * Schedule reconnection with exponential backoff
   * Guards against multiple parallel reconnect timeouts
   */
  private scheduleReconnect(): void {
    // Guard: don't schedule if already scheduled
    if (this.reconnectTimeoutId) {
      logger.debug(
        {
          platform: 'irc',
          correlationId: this.correlationId,
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
          maxAttempts: this.maxReconnectAttempts,
        },
        'Max reconnection attempts reached'
      );
      return;
    }

    const backoffMs = this.reconnectBackoffMs[this.reconnectAttempts] || 30000;
    logger.info(
      {
        platform: 'irc',
        correlationId: this.correlationId,
        attempt: this.reconnectAttempts + 1,
        backoffMs,
      },
      'Scheduling IRC reconnection'
    );

    this.reconnectAttempts++;
    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connect().catch((err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.error(
          {
            platform: 'irc',
            correlationId: this.correlationId,
            error: errMsg,
          },
          'Error during scheduled reconnect'
        );
      });
    }, backoffMs);
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
   */
  async disconnect(): Promise<void> {
    logger.info(
      { platform: 'irc', correlationId: this.correlationId },
      'Disconnecting from IRC server'
    );

    // Clear pending reconnect timeout if any
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
      logger.debug(
        { platform: 'irc', correlationId: this.correlationId },
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

    this.messageQueue = [];
    this.setStatus('disconnected');
    await this.destroy();

    logger.info(
      { platform: 'irc', correlationId: this.correlationId },
      'Successfully disconnected from IRC'
    );
  }

  /**
   * Send message to IRC channel
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    const messageCorrelationId = randomUUID();
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
          correlationId: messageCorrelationId,
        },
        'Sending message to IRC channel'
      );

      // If not connected, queue the message (with capacity check)
      if (!this.isConnected()) {
        // Check queue capacity
        if (this.messageQueue.length >= MESSAGE_QUEUE_MAX_SIZE) {
          const errorMsg = `Message queue full (max ${MESSAGE_QUEUE_MAX_SIZE}). Message dropped.`;
          logger.warn(
            {
              conversationId: request.conversationId,
              messageId: request.messageId,
              channel,
              platform: 'irc',
              correlationId: messageCorrelationId,
              queueSize: this.messageQueue.length,
            },
            errorMsg
          );
          return {
            success: false,
            error: errorMsg,
            sentAt: new Date().toISOString(),
          };
        }

        logger.info(
          {
            conversationId: request.conversationId,
            messageId: request.messageId,
            channel,
            platform: 'irc',
            correlationId: messageCorrelationId,
            queueSize: this.messageQueue.length + 1,
          },
          'IRC not connected, queueing message'
        );

        this.messageQueue.push({
          channel,
          message: request.body,
        });

        // Try to reconnect if not already attempting
        if (this.connectionStatus === 'disconnected' && !this.isConnecting) {
          this.connect().catch((err) => {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger.error(
              { error: errMsg, platform: 'irc', correlationId: messageCorrelationId },
              'Failed to reconnect after message queue'
            );
          });
        }

        return {
          success: false,
          error: 'IRC not connected, message queued for later delivery',
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
          correlationId: messageCorrelationId,
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
          correlationId: messageCorrelationId,
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

  /**
   * Process queued messages when connection is established
   */
  private async processMessageQueue(): Promise<void> {
    if (!this.isConnected() || this.messageQueue.length === 0) {
      return;
    }

    const queueCorrelationId = randomUUID();
    logger.info(
      {
        platform: 'irc',
        correlationId: queueCorrelationId,
        queuedMessages: this.messageQueue.length,
      },
      'Processing queued IRC messages'
    );

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    for (const { channel, message } of queue) {
      try {
        if (!this.client) {
          throw new Error('IRC client not initialized');
        }

        // Sanitize message to prevent CRLF injection
        const sanitizedMessage = sanitizeMessage(message);
        
        // Use say() for safer transmission instead of raw()
        this.client.say(channel, sanitizedMessage);
        logger.debug(
          { channel, platform: 'irc', correlationId: queueCorrelationId },
          'Queued message sent to IRC channel'
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            error: errorMessage,
            channel,
            platform: 'irc',
            correlationId: queueCorrelationId,
          },
          'Error sending queued message'
        );
        // Re-queue the message
        this.messageQueue.push({ channel, message });
      }
    }
  }
}
