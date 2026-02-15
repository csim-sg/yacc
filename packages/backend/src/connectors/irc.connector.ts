import { BaseConnector } from './base/baseConnector';
import { logger } from '../infrastructure/logger';
import type { SendMessageRequest } from '@yacc/common/types/sendMessageRequest.interface';
import type { SendMessageResponse } from '@yacc/common/types/sendMessageResponse.interface';
import type { ValidationError } from '@yacc/common/types/validationError.interface';
import type { ConnectorConfig } from '@yacc/common/types/connectorConfig.type';
import type { IRCFrameworkMessage, IRCFrameworkError } from '../types/ircMessage.type';
import IRC from 'irc-framework';

/**
 * IRC Connector
 *
 * Handles all communication with IRC networks using irc-framework library.
 * Supports:
 * - Real IRC server connections
 * - Sending and receiving messages
 * - Channel management
 * - Connection management with auto-reconnect
 * - Error handling and retry logic
 */

type IRCConfig = ConnectorConfig<'irc'> & {
  server: string;
  port: number;
  nick: string;
  password?: string;
  channels: string[];
};

export class IRCConnector extends BaseConnector<'irc', IRCConfig> {
  private client: IRC | null = null;
  private messageQueue: Array<{ channel: string; message: string }> = [];
  private isConnecting: boolean = false;

  constructor() {
    super('irc');
  }

  /**
   * Connect to IRC server
   */
  async connect(): Promise<void> {
    try {
      if (!this.config) {
        throw new Error('Configuration not set. Call setConfig first.');
      }

      if (this.isConnecting) {
        logger.warn({ platform: 'irc' }, 'Connection already in progress');
        return;
      }

      this.isConnecting = true;
      this.setStatus('reconnecting');

      logger.info(
        {
          platform: 'irc',
          server: this.config.server,
          port: this.config.port,
          nick: this.config.nick,
        },
        'Connecting to IRC server...'
      );

      // Validate connection parameters first
      const validationErrors = await this.validatePlatformConfig(this.config);
      if (validationErrors.length > 0) {
        throw new Error(`IRC validation error: ${validationErrors[0].message}`);
      }

      // Create IRC client instance
      this.client = new IRC({
        host: this.config.server,
        port: this.config.port,
        nick: this.config.nick,
        username: this.config.nick,
        realname: this.config.nick,
        password: this.config.password,
        auto_reconnect: true,
        auto_reconnect_max_retries: this.maxReconnectAttempts,
        auto_reconnect_wait: 4000,
        channel_list_batch_size: 50,
        ping_interval: 60,
      });

      // Set up event handlers
      this.setupClientEventHandlers();

      // Connect to IRC server
      await this.client.connect();

      this.isConnecting = false;
      logger.info(
        {
          platform: 'irc',
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
          server: this.config?.server,
        },
        'Failed to connect to IRC server'
      );

      // Implement exponential backoff for reconnection
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const backoffMs = this.reconnectBackoffMs[this.reconnectAttempts] || 30000;
        logger.info(
          {
            platform: 'irc',
            attempt: this.reconnectAttempts + 1,
            backoffMs,
          },
          'Scheduling IRC reconnection'
        );

        this.reconnectAttempts++;
        setTimeout(() => this.connect(), backoffMs);
      }

      throw error;
    }
  }

  /**
   * Set up IRC client event handlers
   */
  private setupClientEventHandlers(): void {
    if (!this.client) return;

    // Handle successful connection
    this.client.on('registered', () => {
      logger.info({ platform: 'irc' }, 'IRC client registered with server');
      this.setStatus('connected');
      this.reconnectAttempts = 0;

      // Join channels after registration
      if (this.config?.channels) {
        for (const channel of this.config.channels) {
          this.client?.raw(`JOIN ${channel}`);
        }
      }
    });

    // Handle incoming messages
    this.client.on('message', (message: IRCFrameworkMessage) => {
      logger.debug(
        {
          platform: 'irc',
          nick: message.nick,
          channel: message.target,
          text: message.text,
        },
        'Received IRC message'
      );
      this.emit('message', message);
    });

    // Handle connection errors
    this.client.on('error', (error: IRCFrameworkError) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          error: errorMessage,
          platform: 'irc',
        },
        'IRC client error'
      );
      this.setStatus('error', errorMessage);
    });

    // Handle disconnection
    this.client.on('socket close', () => {
      logger.warn({ platform: 'irc' }, 'IRC socket closed');
      this.setStatus('disconnected');
    });

    // Handle connection closure
    this.client.on('close', () => {
      logger.info({ platform: 'irc' }, 'IRC connection closed');
      this.setStatus('disconnected');
    });

    // Handle quit event
    this.client.on('quit', (message: IRCFrameworkMessage) => {
      logger.info(
        {
          platform: 'irc',
          nick: message.nick,
          message: message.text,
        },
        'IRC user quit'
      );
    });

    // Handle join event
    this.client.on('join', (message: IRCFrameworkMessage) => {
      logger.debug(
        {
          platform: 'irc',
          nick: message.nick,
          channel: message.target,
        },
        'User joined IRC channel'
      );
    });

    // Handle part event
    this.client.on('part', (message: IRCFrameworkMessage) => {
      logger.debug(
        {
          platform: 'irc',
          nick: message.nick,
          channel: message.target,
        },
        'User left IRC channel'
      );
    });
  }

  /**
   * Disconnect from IRC server
   */
  async disconnect(): Promise<void> {
    try {
      logger.info({ platform: 'irc' }, 'Disconnecting from IRC server');

      if (this.client) {
        this.client.quit('YACC shutting down');
        this.client = null;
      }

      this.messageQueue = [];
      this.setStatus('disconnected');
      await this.destroy();

      logger.info({ platform: 'irc' }, 'Successfully disconnected from IRC');
    } catch (error) {
      logger.error(
        { error, platform: 'irc' },
        'Error during IRC disconnection'
      );
      throw error;
    }
  }

  /**
   * Send message to IRC channel
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
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
          channel,
          platform: 'irc',
        },
        'Sending message to IRC channel'
      );

      // If not connected, queue the message
      if (!this.isConnected()) {
        logger.info(
          {
            conversationId: request.conversationId,
            channel,
            platform: 'irc',
          },
          'IRC not connected, queueing message'
        );

        this.messageQueue.push({
          channel,
          message: request.body,
        });

        // Try to reconnect
        if (this.connectionStatus === 'disconnected') {
          this.connect().catch((err) => {
            logger.error(
              { error: err, platform: 'irc' },
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

      // Send the message to the channel
      this.client.raw(`PRIVMSG ${channel} :${request.body}`);

      const messageId = `irc-${Date.now()}`;

      logger.info(
        {
          conversationId: request.conversationId,
          channel,
          messageId,
          platform: 'irc',
        },
        'Message sent successfully to IRC channel'
      );

      return {
        success: true,
        platformMessageId: messageId,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        {
          error: errorMessage,
          conversationId: request.conversationId,
          platform: 'irc',
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

    logger.info(
      {
        platform: 'irc',
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

        // Send queued message
        this.client.raw(`PRIVMSG ${channel} :${message}`);
        logger.debug(
          { channel, platform: 'irc' },
          'Queued message sent to IRC channel'
        );
      } catch (error) {
        logger.error(
          {
            error,
            channel,
            platform: 'irc',
          },
          'Error sending queued message'
        );
        // Re-queue the message
        this.messageQueue.push({ channel, message });
      }
    }
  }
}
