import { BaseConnector } from './base/baseConnector';
import { logger } from '../infrastructure/logger';
import type { SendMessageRequest } from '@yacc/common/types/sendMessageRequest.interface';
import type { SendMessageResponse } from '@yacc/common/types/sendMessageResponse.interface';
import type { ValidationError } from '@yacc/common/types/validationError.interface';
import type { ConnectorConfig } from '@yacc/common/types/connectorConfig.type';

/**
 * Telegram Connector
 *
 * Handles all communication with Telegram platform.
 * Supports:
 * - Sending messages to groups and channels
 * - Receiving webhooks from Telegram
 * - Error handling and retry logic
 * - Connection validation
 */

type TelegramConfig = ConnectorConfig<'telegram'> & {
  botToken: string;
  botName?: string;
};

type TelegramApiResponse = {
  ok: boolean;
  result?: unknown;
  description?: string;
};

export class TelegramConnector extends BaseConnector<'telegram', TelegramConfig> {
  private baseUrl: string = 'https://api.telegram.org';

  constructor() {
    super('telegram');
  }

  /**
   * Connect to Telegram (validates token)
   */
  async connect(): Promise<void> {
    try {
      if (!this.config) {
        throw new Error('Configuration not set. Call setConfig first.');
      }

      logger.info({ platform: 'telegram' }, 'Connecting to Telegram...');

      // Validate token by getting bot info
      const response = await this.callTelegramApi('getMe', {});

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.description || 'Unknown error'}`);
      }

      this.setStatus('connected');
      logger.info(
        { platform: 'telegram', botInfo: response.result },
        'Successfully connected to Telegram'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.setStatus('disconnected', errorMessage);
      logger.error(
        { error, platform: 'telegram' },
        'Failed to connect to Telegram'
      );
      throw error;
    }
  }

  /**
   * Disconnect from Telegram (cleanup)
   */
  async disconnect(): Promise<void> {
    try {
      logger.info({ platform: 'telegram' }, 'Disconnecting from Telegram');
      this.setStatus('disconnected');
      await this.destroy();
    } catch (error) {
      logger.error(
        { error, platform: 'telegram' },
        'Error during Telegram disconnection'
      );
      throw error;
    }
  }

  /**
   * Send message to Telegram
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      if (!this.config) {
        throw new Error('Configuration not set');
      }

      logger.debug(
        {
          conversationId: request.conversationId,
          recipientId: request.recipientId,
          platform: 'telegram',
        },
        'Sending message to Telegram'
      );

      // Extract chat ID from recipient ID (format: telegram:chatId)
      const chatId = this.extractChatId(request.recipientId);
      if (!chatId) {
        throw new Error(`Invalid Telegram recipient format: ${request.recipientId}`);
      }

      // Build request parameters
      const params = {
        chat_id: chatId,
        text: request.body,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      };

      // Send message
      const response = await this.callTelegramApi('sendMessage', params);

      if (!response.ok) {
        const error = new Error(
          `Telegram API error: ${response.description || 'Unknown error'}`
        );
        logger.warn(
          {
            conversationId: request.conversationId,
            chatId,
            error: error.message,
            platform: 'telegram',
          },
          'Failed to send message to Telegram'
        );
        throw error;
      }

      const messageId = this.extractMessageId(response.result);

      logger.info(
        {
          conversationId: request.conversationId,
          chatId,
          messageId,
          platform: 'telegram',
        },
        'Message sent successfully to Telegram'
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
          platform: 'telegram',
        },
        'Error sending message to Telegram'
      );

      return {
        success: false,
        error: errorMessage,
        sentAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Validate Telegram-specific configuration
   */
  protected async validatePlatformConfig(config: TelegramConfig): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Validate required fields
    const requiredErrors = this.validateRequired(config, ['botToken']);
    errors.push(...requiredErrors);

    // Validate bot token format (should be like: 123456789:ABCdefGHIjklMNOpqrSTUvwxyz)
    if (config.botToken && !this.isValidTelegramToken(config.botToken)) {
      errors.push({
        field: 'botToken',
        message: 'Invalid Telegram bot token format',
      });
    }

    return errors;
  }

  /**
   * Check if bot token has valid format
   */
  private isValidTelegramToken(token: string): boolean {
    // Telegram token format: digits:alphanumeric_with_dashes_underscores
    const tokenRegex = /^\d{9,10}:[A-Za-z0-9_-]{35}$/;
    return tokenRegex.test(token);
  }

  /**
   * Extract chat ID from recipient ID
   * Format: telegram:chatId or just chatId
   */
  private extractChatId(recipientId: string): string | null {
    if (recipientId.startsWith('telegram:')) {
      return recipientId.substring('telegram:'.length);
    }
    // If it looks like a chat ID (numeric or -numeric), use it directly
    if (/^-?\d+$/.test(recipientId)) {
      return recipientId;
    }
    return null;
  }

  private extractMessageId(result: unknown): string {
    if (!result || typeof result !== 'object') {
      return 'unknown';
    }

    if (!('message_id' in result)) {
      return 'unknown';
    }

    const raw = (result as { message_id: unknown }).message_id;
    return raw === null || raw === undefined ? 'unknown' : String(raw);
  }

  /**
   * Call Telegram API
   */
  private async callTelegramApi(
    method: string,
    params: Record<string, unknown>
  ): Promise<TelegramApiResponse> {
    if (!this.config) {
      throw new Error('Configuration not set');
    }

    const url = `${this.baseUrl}/bot${this.config.botToken}/${method}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error(
          {
            method,
            status: response.status,
            body: text,
            platform: 'telegram',
          },
          'Telegram API HTTP error'
        );

        return {
          ok: false,
          description: `HTTP ${response.status}: ${text}`,
        };
      }

      const data = (await response.json()) as TelegramApiResponse;
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      logger.error(
        {
          error: errorMessage,
          method,
          platform: 'telegram',
        },
        'Error calling Telegram API'
      );

      throw new Error(`Telegram API call failed: ${errorMessage}`);
    }
  }
}
