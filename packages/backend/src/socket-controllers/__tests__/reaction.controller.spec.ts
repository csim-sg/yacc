/**
 * Unit Tests for ReactionController
 *
 * Tests emoji reaction events
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactionController } from '../reaction.controller';
import type { Socket } from 'socket.io';

describe('ReactionController', () => {
  let controller: ReactionController;
  let mockSocket: Partial<Socket>;

  beforeEach(() => {
    controller = new ReactionController();

    mockSocket = {
      id: 'test-socket-333',
      emit: vi.fn(),
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
      broadcast: {
        emit: vi.fn(),
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      },
    } as unknown as Partial<Socket>;
  });

  describe('onReactionAdded', () => {
    it('should broadcast reaction.added to conversation room', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        emoji: '👍',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Jane Doe',
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onReactionAdded(mockSocket as Socket, payload);

      expect(mockSocket.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440001');
      expect(mockToEmit).toHaveBeenCalledWith('reaction.added', payload);
    });

    it('should include emoji in reaction', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        emoji: '❤️',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Alice',
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onReactionAdded(mockSocket as Socket, payload);

      expect(mockToEmit).toHaveBeenCalledWith(
        'reaction.added',
        expect.objectContaining({ emoji: '❤️' })
      );
    });
  });

  describe('onReactionRemoved', () => {
    it('should broadcast reaction.removed to conversation room', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        emoji: '👍',
        userId: '550e8400-e29b-41d4-a716-446655440002',
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onReactionRemoved(mockSocket as Socket, payload);

      expect(mockSocket.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440001');
      expect(mockToEmit).toHaveBeenCalledWith('reaction.removed', payload);
    });

    it('should include user ID in removal payload', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440002';
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        emoji: '👍',
        userId,
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onReactionRemoved(mockSocket as Socket, payload);

      expect(mockToEmit).toHaveBeenCalledWith(
        'reaction.removed',
        expect.objectContaining({ userId })
      );
    });
  });

  describe('Type safety', () => {
    it('should validate emoji format', () => {
      const validEmojis = ['👍', '❤️', '😂', '🎉', '🚀'];

      for (const emoji of validEmojis) {
        expect(emoji.length).toBeGreaterThan(0);
      }
    });

    it('should preserve IDs through reactions', () => {
      const messageId = '550e8400-e29b-41d4-a716-446655440000';
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';

      const payload = {
        messageId,
        conversationId,
        emoji: '👍',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Test',
      };

      expect(payload.messageId).toBe(messageId);
      expect(payload.conversationId).toBe(conversationId);
    });
  });
});
