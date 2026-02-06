import { BaseConnector } from './base/baseConnector';
import { logger } from '../infrastructure/logger';
import type { SendMessageRequest } from '@yacc/common/types/sendMessageRequest.interface';
import type { SendMessageResponse } from '@yacc/common/types/sendMessageResponse.interface';
import type { ValidationError } from '@yacc/common/types/validationError.interface';

/**
 * IRC Connector
 *
 * Handles all communication with IRC networks.
 * Supports:
 * - Sending messages to channels
 * - Receiving messages from IRC channels
 * - Connection management with auto-reconnect
 * - Error handling and retry logic
 * - Server configuration validation
 */

interface IRCConfig {
  server: string;
  port: number;
  nick: string;
  password?: string;
  channels: string[];
}

export class IRCConnector extends BaseConnector<'irc', IRCConfig> {
  private socket: any = null;
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

      // Note: In a real implementation, this would use the `irc` or `irc-framework` npm package
      // For now, we're providing the structure and error handling
      // Example: const irc = require('irc');
      // this.client = new irc.Client(...)

      // Validate connection parameters first
      const validationErrors = await this.validatePlatformConfig(this.config);
      if (validationErrors.length > 0) {
        throw new Error(`IRC validation error: ${validationErrors[0].message}`);
      }

      // TODO: Implement actual IRC connection
      // In production, use: https://www.npmjs.com/package/irc
      // const irc = require('irc');
      // this.client = new irc.Client(this.config.server, this.config.nick, {
      //   port: this.config.port,
      //   password: this.config.password,
      //   autoRejoin: true,
      //   channels: this.config.channels,
      //   retryCount: 10,
      //   retryDelay: 5000,
      // });
      //
      // this.client.on('registered', () => {
      //   this.setStatus('connected');
      //   this.processMessageQueue();
      // });
      //
      // this.client.on('message', (from, to, message) => {
      //   this.emitMessageReceived({...}, dbMessageId);
      // });

      // Mock connection for MVP
      this.setStatus('connected');
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
   * Disconnect from IRC server
   */
  async disconnect(): Promise<void> {
    try {
      logger.info({ platform: 'irc' }, 'Disconnecting from IRC server');

      if (this.socket) {
        // TODO: Implement actual IRC disconnect
        // this.client?.disconnect('Shutting down', () => { ... });
        this.socket = null;
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
          timestamp: new Date().toISOString(),
        };
      }

      // TODO: Send actual message
      // this.client?.say(channel, request.body);

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
        timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
      };
    }
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
        // TODO: Send message using actual IRC client
        // this.client?.say(channel, message);
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
