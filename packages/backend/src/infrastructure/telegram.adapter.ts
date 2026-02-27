/**
 * Telegram Adapter
 *
 * Platform adapter for Telegram Bot API integration.
 * Implements PlatformAdapter interface for unified message handling.
 *
 * Responsibilities:
 * - Connect to Telegram Bot API
 * - Poll for incoming messages and emit as InboundMessageEvent
 * - Send outbound messages to Telegram chats
 * - Handle API rate limits and errors
 *
 * @see ADR-005 Addendum-2 - PlatformAdapter Interface
 */

import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
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
 * Telegram Adapter Configuration
 */
export interface TelegramAdapterConfig {
  botToken: string;
  botName?: string;
}

type TelegramRuntimeConfig = BaseAdapterConfig & {
  credentials?: {
    botToken?: string;
  };
};

/**
 * Telegram API response type
 */
type TelegramApiResponse<T = unknown> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

/**
 * Telegram message type
 */
type TelegramMessage = {
  message_id: number;
  from?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  text?: string;
  date: number;
};

/**
 * Telegram update type
 */
type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

/**
 * Telegram Adapter
 *
 * Implements PlatformAdapter for Telegram Bot API.
 */
export class TelegramAdapter extends EventEmitter implements PlatformAdapter<TelegramRuntimeConfig> {
  readonly platform = 'telegram';
  status: AdapterStatus = 'disconnected';

  /**
   * Adapter metadata for capability detection
   */
  readonly metadata: AdapterMetadata = {
    platform: 'telegram',
    displayName: 'Telegram',
    version: '1.0.0',
    capabilities: [
      'send_text',
      'send_attachments',
      'receive_text',
      'receive_attachments',
      'delete_message',
      'update_message',
      'typing_indicator',
      'reactions',
    ],
  };

  private config: TelegramAdapterConfig | null = null;
  private baseUrl = 'https://api.telegram.org';
  private lastUpdateId = 0;
  private pollIntervalId: NodeJS.Timeout | null = null;
  private lastMessageAt: Date | null = null;
  private isPolling = false;

  /**
   * Set adapter configuration
   */
  setConfig(config: TelegramAdapterConfig): void {
    this.config = config;
  }

  /**
   * Configure adapter with runtime configuration (PlatformAdapter interface)
   *
   * @param config - Configuration object (uses BaseAdapterConfig structure)
   * @returns true if configuration is valid
   */
  configure(config: TelegramRuntimeConfig): boolean {
    if (!config.credentials?.botToken) {
      return false;
    }
    this.config = {
      botToken: config.credentials.botToken,
    };
    return true;
  }

  /**
   * Connect to Telegram (validate bot token)
   */
  async connect(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not set. Call setConfig first.');
    }

    this.status = 'connecting';

    logger.info({ platform: 'telegram' }, 'Connecting to Telegram...');

    try {
      const response = await this.callTelegramApi('getMe', {});

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.description || 'Unknown error'}`);
      }

      this.status = 'connected';
      this.emit('adapter:connected');

      // Start polling for updates
      this.startPolling();

      logger.info(
        { platform: 'telegram', botInfo: response.result },
        'Successfully connected to Telegram'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.status = 'error';
      this.emit('adapter:error', new Error(errorMessage));

      logger.error(
        { error: errorMessage, platform: 'telegram' },
        'Failed to connect to Telegram'
      );
      throw error;
    }
  }

  /**
   * Disconnect from Telegram
   */
  async disconnect(): Promise<void> {
    logger.info({ platform: 'telegram' }, 'Disconnecting from Telegram');

    this.stopPolling();
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
   * Send message to Telegram
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

      if (this.status !== 'connected') {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: 'Telegram not connected',
            retryable: true,
          },
          timestamp: new Date(),
        };
      }

      const chatId = this.extractChatId(message);
      if (!chatId) {
        return {
          success: false,
          error: {
            code: 'UNKNOWN_ERROR',
            message: 'Invalid Telegram chat ID format',
            retryable: false,
          },
          timestamp: new Date(),
        };
      }

      const response = await this.callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: message.body,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });

      if (!response.ok) {
        const errorCode = this.mapErrorCode(response.error_code);
        return {
          success: false,
          error: {
            code: errorCode,
            message: response.description || 'Telegram API error',
            retryable: errorCode === 'RATE_LIMIT' || errorCode === 'NETWORK_ERROR',
          },
          timestamp: new Date(),
        };
      }

      const messageId = this.extractMessageId(response.result);

      logger.info(
        {
          conversationId: message.conversationId,
          chatId,
          messageId,
          platform: 'telegram',
          correlationId: traceCorrelationId,
        },
        'Message sent successfully to Telegram'
      );

      return {
        success: true,
        externalMessageId: messageId,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(
        {
          error: errorMessage,
          conversationId: message.conversationId,
          platform: 'telegram',
          correlationId: traceCorrelationId,
        },
        'Error sending message to Telegram'
      );

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: errorMessage,
          retryable: true,
        },
        timestamp: new Date(),
      };
    }
  }

  /**
   * Start polling for updates
   */
  private startPolling(): void {
    if (this.isPolling) return;

    this.isPolling = true;
    this.pollForUpdates();
  }

  /**
   * Stop polling for updates
   */
  private stopPolling(): void {
    this.isPolling = false;
    if (this.pollIntervalId) {
      clearTimeout(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  /**
   * Poll for updates from Telegram
   */
  private async pollForUpdates(): Promise<void> {
    if (!this.isPolling || this.status !== 'connected') {
      return;
    }

    try {
      const response = await this.callTelegramApi('getUpdates', {
        offset: this.lastUpdateId + 1,
        timeout: 30,
        allowed_updates: ['message'],
      });

      if (response.ok && Array.isArray(response.result)) {
        for (const update of response.result as TelegramUpdate[]) {
          this.lastUpdateId = update.update_id;
          this.processUpdate(update);
        }
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : 'Unknown', platform: 'telegram' },
        'Error polling for Telegram updates'
      );
    }

    // Continue polling
    if (this.isPolling) {
      this.pollIntervalId = setTimeout(() => {
        this.pollForUpdates();
      }, 1000);
    }
  }

  /**
   * Process a Telegram update
   */
  private processUpdate(update: TelegramUpdate): void {
    if (!update.message) return;

    const msg = update.message;
    this.lastMessageAt = new Date();

    // Skip messages without text
    if (!msg.text) return;

    // Skip messages from the bot itself (we don't have bot user ID, skip by checking config)
    // In practice, Telegram doesn't send bot's own messages via getUpdates

    const inboundEvent: InboundMessageEvent = {
      platform: 'telegram',
      externalThreadId: String(msg.chat.id),
      sender: {
        externalUserId: String(msg.from?.id || 'unknown'),
        displayName: msg.from?.username || msg.from?.first_name || 'Unknown',
      },
      body: msg.text,
      receivedAt: new Date(msg.date * 1000),
      rawPayload: update,
      correlationId: randomUUID(),
    };

    this.emit('message:inbound', inboundEvent);
  }

  /**
   * Extract chat ID from message
   */
  private extractChatId(message: OutboundMessagePayload): string | null {
    const recipientId = message.metadata?.recipientId as string | undefined;
    if (recipientId) {
      if (recipientId.startsWith('telegram:')) {
        return recipientId.substring('telegram:'.length);
      }
      // If it looks like a chat ID (numeric or -numeric)
      if (/^-?\d+$/.test(recipientId)) {
        return recipientId;
      }
    }
    return null;
  }

  /**
   * Extract message ID from API response
   */
  private extractMessageId(result: unknown): string {
    if (!result || typeof result !== 'object') {
      return 'unknown';
    }
    const msg = result as { message_id?: unknown };
    return msg.message_id !== undefined ? String(msg.message_id) : 'unknown';
  }

  /**
   * Map Telegram error code to our error code
   */
  private mapErrorCode(code: number | undefined): 'RATE_LIMIT' | 'INVALID_CREDENTIALS' | 'NETWORK_ERROR' | 'MESSAGE_TOO_LONG' | 'ATTACHMENT_TOO_LARGE' | 'UNKNOWN_ERROR' {
    if (!code) return 'UNKNOWN_ERROR';

    switch (code) {
      case 429:
        return 'RATE_LIMIT';
      case 401:
      case 403:
        return 'INVALID_CREDENTIALS';
      case 400:
        return 'MESSAGE_TOO_LONG';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  /**
   * Call Telegram Bot API
   */
  private async callTelegramApi<T = unknown>(
    method: string,
    params: Record<string, unknown>
  ): Promise<TelegramApiResponse<T>> {
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
          { method, status: response.status, body: text, platform: 'telegram' },
          'Telegram API HTTP error'
        );

        return {
          ok: false,
          description: `HTTP ${response.status}: ${text}`,
          error_code: response.status,
        };
      }

      return (await response.json()) as TelegramApiResponse<T>;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      logger.error(
        { error: errorMessage, method, platform: 'telegram' },
        'Error calling Telegram API'
      );

      return {
        ok: false,
        description: errorMessage,
      };
    }
  }
}

/**
 * Factory function to create Telegram adapter
 */
export function createTelegramAdapter(): TelegramAdapter {
  return new TelegramAdapter();
}
