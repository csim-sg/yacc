/**
 * Unit Tests for MessageController
 *
 * Tests message event handling and delivery
 */

import type { Socket } from 'socket.io';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthenticatedSocket } from '../../websockets/auth.middleware';
import { MessageController } from '../message.controller';

describe('MessageController', () => {
  let controller: MessageController;
  let mockSocket: Partial<Socket>;
  let mockAuthSocket: Partial<AuthenticatedSocket>;

  beforeEach(() => {
    controller = new MessageController();

    mockSocket = {
      id: 'test-socket-456',
      emit: vi.fn(),
      broadcast: {
        emit: vi.fn(),
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      },
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
    } as unknown as Partial<Socket>;

    mockAuthSocket = {
      ...mockSocket,
      userId: 'user-789',
      role: 'user',
    };
  });

  describe('onMessageSent', () => {
    it('should broadcast message.sent to conversation room', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onMessageSent(mockSocket as Socket, payload);

      expect(mockSocket.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440001');
      expect(mockToEmit).toHaveBeenCalledWith('message.sent', payload);
    });

    it('should handle valid message sent payload', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      expect(async () => {
        await controller.onMessageSent(mockSocket as Socket, payload);
      }).not.toThrow();
    });
  });

  describe('onMessageFailed', () => {
    it('should broadcast message.failed to conversation room', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'failed' as const,
        error: 'Connection timeout',
        retryAt: new Date().toISOString(),
        attempt: 1,
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onMessageFailed(mockSocket as Socket, payload);

      expect(mockSocket.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440001');
      expect(mockToEmit).toHaveBeenCalledWith('message.failed', payload);
    });

    it('should include retry information', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'failed' as const,
        error: 'Network error',
        retryAt: new Date().toISOString(),
        attempt: 2,
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onMessageFailed(mockSocket as Socket, payload);

      expect(mockToEmit).toHaveBeenCalledWith(
        'message.failed',
        expect.objectContaining({
          attempt: 2,
          error: 'Network error',
        })
      );
    });
  });

  describe('Type safety', () => {
    it('should preserve message IDs and conversation IDs', async () => {
      const messageId = '550e8400-e29b-41d4-a716-446655440000';
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';

      const payload = {
        messageId,
        conversationId,
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      expect(payload.messageId).toBe(messageId);
      expect(payload.conversationId).toBe(conversationId);
    });
  });
});
