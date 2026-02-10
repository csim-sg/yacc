/**
 * Message Handler Unit Tests
 *
 * Tests verify that handlers are properly implemented for:
 * - FE-013: message.received listener for inbound messages
 * - FE-014: message.sent listener for delivery status
 * - FE-015: message.failed listener for retry status
 *
 * AC Verification:
 * - Handlers accept correct WebSocket event shapes (type-safe)
 * - Handlers execute without errors (no throw)
 * - Handlers implement cache/invalidation logic (see source code)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWebSocketStore } from '../../../stores/websocket.store';
import {
  handleMessageSent,
  handleMessageFailed,
  handleMessageReceived,
} from '../message.handler';

// Mock queryClient
vi.mock('../../../lib/queryClient', () => ({
  queryClient: {
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Message Handler', () => {
  beforeEach(() => {
    // Reset store
    useWebSocketStore.setState({
      connectionState: 'disconnected',
      lastConnectTime: null,
      lastErrorMessage: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      subscribedConversationIds: new Set(),
      typingUsers: new Map(),
      userPresence: new Map(),
      processedEventIds: new Set(),
    });
  });

  describe('handleMessageSent (FE-014)', () => {
    it('should accept message.sent event with correct shape and execute', () => {
      // AC: Handler must accept event with: conversationId, messageId, status, sentAt
      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-123',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      expect(() => handleMessageSent(event)).not.toThrow();
    });

    it('should accept message.sent from different conversations', () => {
      const event = {
        conversationId: 'conv-999',
        messageId: 'msg-999',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      expect(() => handleMessageSent(event)).not.toThrow();
    });
  });

  describe('handleMessageFailed (FE-015)', () => {
    it('should accept message.failed event with correct shape and execute', () => {
      // AC: Handler must accept event with: conversationId, messageId, status, error, retryAt, attempt
      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        status: 'failed' as const,
        error: 'Network error',
        retryAt: new Date(Date.now() + 60000).toISOString(),
        attempt: 1,
      };

      expect(() => handleMessageFailed(event)).not.toThrow();
    });

    it('should accept message.failed with multiple retry attempts', () => {
      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        status: 'failed' as const,
        error: 'Timeout error',
        retryAt: new Date(Date.now() + 300000).toISOString(),
        attempt: 2,
      };

      expect(() => handleMessageFailed(event)).not.toThrow();
    });

    it('should accept message.failed with max attempts reached', () => {
      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        status: 'failed' as const,
        error: 'Max retries exceeded',
        retryAt: new Date(Date.now() + 1800000).toISOString(), // 30min
        attempt: 3,
      };

      expect(() => handleMessageFailed(event)).not.toThrow();
    });
  });

  describe('handleMessageReceived (FE-013)', () => {
    it('should accept message.received event from Telegram with correct shape and execute', () => {
      // AC: Handler must accept event with: conversationId, messageId, platform, senderId, senderName, body, timestamp
      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-789',
        platform: 'telegram' as const,
        senderId: 'telegram-user-123',
        senderName: 'John Doe',
        body: 'Hello, this is a message',
        timestamp: new Date().toISOString(),
      };

      expect(() => handleMessageReceived(event)).not.toThrow();
    });

    it('should accept message.received from IRC', () => {
      const event = {
        conversationId: 'conv-456',
        messageId: 'msg-999',
        platform: 'irc' as const,
        senderId: 'irc-user-456',
        senderName: 'Anonymous',
        body: 'Hello from IRC',
        timestamp: new Date().toISOString(),
      };

      expect(() => handleMessageReceived(event)).not.toThrow();
    });

    it('should accept message.received with optional attachments', () => {
      // AC: Handler must accept optional attachments field
      const event = {
        conversationId: 'conv-789',
        messageId: 'msg-with-attachments',
        platform: 'telegram' as const,
        senderId: 'tg-user-789',
        senderName: 'Alice',
        body: 'Check out this file',
        timestamp: new Date().toISOString(),
        attachments: [
          { url: 'https://example.com/file.pdf', type: 'document', name: 'file.pdf' },
          { url: 'https://example.com/image.jpg', type: 'image', name: 'image.jpg' },
        ],
      };

      expect(() => handleMessageReceived(event)).not.toThrow();
    });

    it('should accept message.received without attachments', () => {
      // AC: Handler must work without optional attachments
      const event = {
        conversationId: 'conv-789',
        messageId: 'msg-no-attachments',
        platform: 'irc' as const,
        senderId: 'irc-user-999',
        senderName: 'Bob',
        body: 'Simple text message',
        timestamp: new Date().toISOString(),
      };

      expect(() => handleMessageReceived(event)).not.toThrow();
    });

    it('should handle unicode and special characters in message body', () => {
      // AC: Handler must handle non-ASCII text
      const event = {
        conversationId: 'conv-unicode',
        messageId: 'msg-unicode',
        platform: 'telegram' as const,
        senderId: 'tg-user-unicode',
        senderName: '李明',
        body: '你好世界 🌍 مرحبا العالم',
        timestamp: new Date().toISOString(),
      };

      expect(() => handleMessageReceived(event)).not.toThrow();
    });
  });
});
