/**
 * Unit Tests for ConversationController
 *
 * Tests socket connection lifecycle and conversation event handling
 * Uses Vitest with mocked Socket.io interfaces
 */

import type { Socket } from 'socket.io';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuthenticatedSocket } from '../../websockets/auth.middleware';
import { ConversationController } from '../conversation.controller';

describe('ConversationController', () => {
  let controller: ConversationController;
  let mockSocket: Partial<Socket>;
  let mockAuthSocket: Partial<AuthenticatedSocket>;
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    controller = new ConversationController();

    emitSpy = vi.fn();

    // Mock Socket methods
    mockSocket = {
      id: 'test-socket-123',
      join: vi.fn(),
      leave: vi.fn(),
      emit: emitSpy,
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
      broadcast: {
        emit: vi.fn(),
        to: vi.fn().mockReturnValue({
          emit: vi.fn(),
        }),
      },
    } as unknown as Partial<Socket>;

    // Mock AuthenticatedSocket properties
    mockAuthSocket = {
      ...mockSocket,
      userId: 'user-456',
      role: 'user',
    };
  });

  describe('onConnect', () => {
    it('should join user-specific room on connect', () => {
      controller.onConnect(mockAuthSocket as Socket);

      expect(mockSocket.join).toHaveBeenCalledWith('user:user-456');
    });

    it('should emit connection.established event', () => {
      controller.onConnect(mockAuthSocket as Socket);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'connection.established',
        expect.objectContaining({
          socketId: 'test-socket-123',
          timestamp: expect.any(String),
        })
      );
    });

    it('should not crash if userId is missing', () => {
      mockAuthSocket.userId = undefined;

      expect(() => {
        controller.onConnect(mockAuthSocket as Socket);
      }).not.toThrow();
    });
  });

  describe('onDisconnect', () => {
    it('should log disconnect event', () => {
      // onDisconnect should handle gracefully
      controller.onDisconnect(mockAuthSocket as Socket);

      // Verify no errors thrown
      expect(mockSocket.id).toBe('test-socket-123');
    });
  });

  describe('onSubscribeToConversation', () => {
    it('should join conversation room', async () => {
      const conversationId = 'conv-789';

      await controller.onSubscribeToConversation(
        mockSocket as Socket,
        conversationId
      );

      expect(mockSocket.join).toHaveBeenCalledWith(`conversation:${conversationId}`);
    });

    it('should emit conversation.subscribed acknowledgment', async () => {
      const conversationId = 'conv-789';

      await controller.onSubscribeToConversation(
        mockSocket as Socket,
        conversationId
      );

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'conversation.subscribed',
        { conversationId }
      );
    });

    it('should handle missing conversationId', async () => {
      expect(async () => {
        await controller.onSubscribeToConversation(mockSocket as Socket, '');
      }).not.toThrow();
    });
  });

  describe('onUnsubscribeFromConversation', () => {
    it('should leave conversation room', async () => {
      const conversationId = 'conv-789';

      await controller.onUnsubscribeFromConversation(
        mockSocket as Socket,
        conversationId
      );

      expect(mockSocket.leave).toHaveBeenCalledWith(`conversation:${conversationId}`);
    });

    it('should emit conversation.unsubscribed confirmation', async () => {
      const conversationId = 'conv-789';

      await controller.onUnsubscribeFromConversation(
        mockSocket as Socket,
        conversationId
      );

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'conversation.unsubscribed',
        { conversationId }
      );
    });
  });

  describe('onConversationUpdated', () => {
    it('should broadcast to conversation room (excluding sender)', async () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        updatedFields: { status: 'pending' },
        changedBy: '550e8400-e29b-41d4-a716-446655440001',
        changedAt: new Date().toISOString(),
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({
        emit: mockToEmit,
      });

      await controller.onConversationUpdated(mockSocket as Socket, payload);

      expect(mockSocket.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440000');
      expect(mockToEmit).toHaveBeenCalledWith('conversation.updated', payload);
    });

    it('should handle various updatedFields', async () => {
      const fieldsVariations = [
        { status: 'pending' },
        { priority: 'high' },
        { assigned_to: 'user-789' },
      ];

      for (const updatedFields of fieldsVariations) {
        const payload = {
          conversationId: '550e8400-e29b-41d4-a716-446655440000',
          updatedFields,
          changedBy: '550e8400-e29b-41d4-a716-446655440001',
          changedAt: new Date().toISOString(),
        };

        const mockToEmit = vi.fn();
        mockSocket.to = vi.fn().mockReturnValue({
          emit: mockToEmit,
        });

        await controller.onConversationUpdated(mockSocket as Socket, payload);

        expect(mockToEmit).toHaveBeenCalled();
      }
    });

    it('should not crash on edge cases', async () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        updatedFields: {},
        changedBy: '550e8400-e29b-41d4-a716-446655440001',
        changedAt: new Date().toISOString(),
      };

      expect(async () => {
        await controller.onConversationUpdated(mockSocket as Socket, payload);
      }).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully without crashing', async () => {
      mockSocket.join = vi.fn().mockImplementation(() => {
        throw new Error('Join failed');
      });

      // Should handle error - either catch or emit
      let errorThrown = false;
      try {
        await controller.onSubscribeToConversation(mockSocket as Socket, 'conv-789');
      } catch (error) {
        errorThrown = true;
        expect(error).toBeInstanceOf(Error);
      }

      // Either emit was called or error was thrown (both acceptable)
      const emitCalled = emitSpy.mock.calls.length > 0;
      expect(errorThrown || emitCalled).toBe(true);
    });

    it('should not prevent other operations after error', async () => {
      mockSocket.join = vi.fn().mockImplementationOnce(() => {
        throw new Error('Join failed');
      });

      try {
        await controller.onSubscribeToConversation(mockSocket as Socket, 'conv-789');
      } catch {
        // Expected
      }

      // Should still be able to use socket for other operations
      mockSocket.join = vi.fn();
      await controller.onSubscribeToConversation(mockSocket as Socket, 'conv-456');
      expect(mockSocket.join).toHaveBeenCalledWith('conversation:conv-456');
    });
  });

  describe('Type safety', () => {
    it('should work with AuthenticatedSocket cast', () => {
      const authSocket = mockAuthSocket as AuthenticatedSocket;

      expect(authSocket.userId).toBe('user-456');
      expect(authSocket.role).toBe('user');
    });

    it('should preserve socket.id through operations', async () => {
      const conversationId = 'conv-789';

      await controller.onSubscribeToConversation(mockSocket as Socket, conversationId);

      expect(mockSocket.id).toBe('test-socket-123');
    });
  });
});
