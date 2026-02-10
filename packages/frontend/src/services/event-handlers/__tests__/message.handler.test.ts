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
 * - Handlers implement cache mutation and invalidation logic (verified via mocks)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWebSocketStore } from '../../../stores/websocket.store';
import {
  handleMessageSent,
  handleMessageFailed,
  handleMessageReceived,
} from '../message.handler';
import type { ListMessagesResponse } from '../../conversations.service';

// Use hoisted to create mocks that can be accessed by vi.mock
const mocks = vi.hoisted(() => ({
  getQueryData: vi.fn(),
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn(),
}));

// Mock queryClient
vi.mock('../../../lib/queryClient', () => ({
  queryClient: {
    getQueryData: mocks.getQueryData,
    setQueryData: mocks.setQueryData,
    invalidateQueries: mocks.invalidateQueries,
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

    // Reset mocks
    mocks.getQueryData.mockClear();
    mocks.setQueryData.mockClear();
    mocks.invalidateQueries.mockClear();
  });

  describe('handleMessageSent (FE-014)', () => {
    it('should accept message.sent event with correct shape', () => {
      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-123',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      expect(() => handleMessageSent(event)).not.toThrow();
    });

    it('should update message status to sent and call setQueryData', () => {
      const mockMessages = {
        data: [
          {
            id: 'msg-123',
            conversationId: 'conv-123',
            senderName: 'Me',
            body: 'Test message',
            status: 'pending' as const,
            direction: 'outbound' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      mocks.getQueryData.mockReturnValue(mockMessages);

      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-123',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      handleMessageSent(event);

      // AC: Handler must call setQueryData (update cache with sent status)
      expect(mocks.setQueryData).toHaveBeenCalled();
      const setCall = mocks.setQueryData.mock.calls[0];
      if (setCall && setCall[1]) {
        const cachedData = setCall[1] as ListMessagesResponse;
        expect(cachedData.data[0].status).toBe('sent');
      }
    });

    it('should invalidate conversations list to update UI', () => {
      mocks.getQueryData.mockReturnValue(null);

      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-123',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      handleMessageSent(event);

      // AC: Handler must call invalidateQueries for conversations
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['conversations'],
      });
    });
  });

  describe('handleMessageFailed (FE-015)', () => {
    it('should accept message.failed event with correct shape', () => {
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

    it('should update message status to failed and call setQueryData', () => {
      const mockMessages = {
        data: [
          {
            id: 'msg-456',
            conversationId: 'conv-123',
            senderName: 'Me',
            body: 'Test message',
            status: 'pending' as const,
            direction: 'outbound' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      mocks.getQueryData.mockReturnValue(mockMessages);

      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        status: 'failed' as const,
        error: 'Network error',
        retryAt: new Date(Date.now() + 60000).toISOString(),
        attempt: 1,
      };

      handleMessageFailed(event);

      // AC: Handler must call setQueryData (update cache with failed status)
      expect(mocks.setQueryData).toHaveBeenCalled();
      const setCall = mocks.setQueryData.mock.calls[0];
      if (setCall && setCall[1]) {
        const cachedData = setCall[1] as ListMessagesResponse;
        expect(cachedData.data[0].status).toBe('failed');
      }
    });

    it('should invalidate conversations list on message failure', () => {
      mocks.getQueryData.mockReturnValue(null);

      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        status: 'failed' as const,
        error: 'Timeout error',
        retryAt: new Date(Date.now() + 300000).toISOString(),
        attempt: 2,
      };

      handleMessageFailed(event);

      // AC: Handler must call invalidateQueries for conversations
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['conversations'],
      });
    });

    it('should handle max retry attempts', () => {
      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-456',
        status: 'failed' as const,
        error: 'Max retries exceeded',
        retryAt: new Date(Date.now() + 1800000).toISOString(),
        attempt: 3,
      };

      expect(() => handleMessageFailed(event)).not.toThrow();
    });
  });

  describe('handleMessageReceived (FE-013)', () => {
    it('should accept message.received from Telegram with correct shape', () => {
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

    it('should add new inbound message to cache when not duplicate', () => {
      const mockMessages = {
        data: [
          {
            id: 'msg-existing',
            conversationId: 'conv-123',
            senderName: 'Previous sender',
            body: 'Earlier message',
            status: 'sent' as const,
            direction: 'inbound' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      mocks.getQueryData.mockReturnValue(mockMessages);

      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-789',
        platform: 'telegram' as const,
        senderId: 'tg-user-123',
        senderName: 'John Doe',
        body: 'Hello, this is a message',
        timestamp: new Date().toISOString(),
      };

      handleMessageReceived(event);

      // AC: Handler must call setQueryData (add message to cache)
      expect(mocks.setQueryData).toHaveBeenCalled();
      const setCall = mocks.setQueryData.mock.calls[0];
      if (setCall && setCall[1]) {
        // Verify message was added (array length increased)
        const cachedData = setCall[1] as ListMessagesResponse;
        expect(cachedData.data.length).toBe(2);
        expect(cachedData.data[0].id).toBe('msg-789');
      }
    });

    it('should prevent duplicate messages by messageId', () => {
      const mockMessages = {
        data: [
          {
            id: 'msg-789',
            conversationId: 'conv-123',
            senderName: 'John Doe',
            body: 'Hello, this is a message',
            status: 'sent' as const,
            direction: 'inbound' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      mocks.getQueryData.mockReturnValue(mockMessages);

      const event = {
        conversationId: 'conv-123',
        messageId: 'msg-789',
        platform: 'telegram' as const,
        senderId: 'tg-user-123',
        senderName: 'John Doe',
        body: 'Hello, this is a message',
        timestamp: new Date().toISOString(),
      };

      handleMessageReceived(event);

      // AC: Handler must NOT call setQueryData for duplicates (dedup by messageId)
      expect(mocks.setQueryData).not.toHaveBeenCalled();
    });

    it('should invalidate conversations list on message received', () => {
      mocks.getQueryData.mockReturnValue(null);

      const event = {
        conversationId: 'conv-456',
        messageId: 'msg-999',
        platform: 'irc' as const,
        senderId: 'irc-user-456',
        senderName: 'Anonymous',
        body: 'Hello from IRC',
        timestamp: new Date().toISOString(),
      };

      handleMessageReceived(event);

      // AC: Handler must call invalidateQueries for conversations
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['conversations'],
      });
    });

    it('should accept message.received with optional attachments', () => {
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
        ],
      };

      expect(() => handleMessageReceived(event)).not.toThrow();
    });

    it('should handle IRC messages', () => {
      const event = {
        conversationId: 'conv-irc',
        messageId: 'msg-irc-123',
        platform: 'irc' as const,
        senderId: 'irc-nick',
        senderName: 'NickName',
        body: 'IRC message',
        timestamp: new Date().toISOString(),
      };

      expect(() => handleMessageReceived(event)).not.toThrow();
    });
  });
});
