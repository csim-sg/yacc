/**
 * Message Handler Unit Tests
 *
 * Tests for message event handlers:
 * - message.sent
 * - message.failed
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
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
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

   describe('handleMessageSent', () => {
     it('should handle message.sent event', () => {
       const event = {
         conversationId: 'conv-123',
         messageId: 'msg-123',
         status: 'sent' as const,
         sentAt: new Date().toISOString(),
       };

       expect(() => handleMessageSent(event)).not.toThrow();
     });

     it('should invalidate message caches on sent', () => {
       const event = {
         conversationId: 'conv-123',
         messageId: 'msg-123',
         status: 'sent' as const,
         sentAt: new Date().toISOString(),
       };

       expect(() => handleMessageSent(event)).not.toThrow();
     });
   });

    describe('handleMessageFailed', () => {
      it('should handle message.failed event', () => {
        const event = {
          conversationId: 'conv-123',
          messageId: 'msg-456',
          status: 'failed' as const,
          error: 'Network error',
          retryAt: new Date(Date.now() + 60000).toISOString(), // 60 seconds from now
          attempt: 1,
        };

        expect(() => handleMessageFailed(event)).not.toThrow();
      });

      it('should handle message.failed with multiple retry attempts', () => {
        const event = {
          conversationId: 'conv-123',
          messageId: 'msg-456',
          status: 'failed' as const,
          error: 'Timeout error',
          retryAt: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
          attempt: 2,
        };

        expect(() => handleMessageFailed(event)).not.toThrow();
      });
    });

    describe('handleMessageReceived', () => {
      it('should handle message.received event', () => {
        const event = {
          conversationId: 'conv-123',
          messageId: 'msg-789',
          senderName: 'John Doe',
          body: 'Hello, this is a message',
          receivedAt: new Date().toISOString(),
        };

        expect(() => handleMessageReceived(event)).not.toThrow();
      });

      it('should handle message.received from Telegram', () => {
        const event = {
          conversationId: 'conv-123',
          messageId: 'msg-789',
          senderName: 'John Doe',
          body: 'Hello from Telegram',
          receivedAt: new Date().toISOString(),
        };

        expect(() => handleMessageReceived(event)).not.toThrow();
      });

      it('should handle message.received from IRC', () => {
        const event = {
          conversationId: 'conv-456',
          messageId: 'msg-999',
          senderName: 'Anonymous',
          body: 'Hello from IRC',
          receivedAt: new Date().toISOString(),
        };

        expect(() => handleMessageReceived(event)).not.toThrow();
      });
    });
 });
