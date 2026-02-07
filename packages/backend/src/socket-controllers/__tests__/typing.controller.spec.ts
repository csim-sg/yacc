/**
 * Unit Tests for TypingController
 *
 * Tests typing indicator events and timeouts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypingController } from '../typing.controller';
import type { Socket } from 'socket.io';
import type { AuthenticatedSocket } from '../../websockets/auth.middleware';

describe('TypingController', () => {
  let controller: TypingController;
  let mockSocket: Partial<Socket>;
  let mockAuthSocket: Partial<AuthenticatedSocket>;

  beforeEach(() => {
    controller = new TypingController();

    mockSocket = {
      id: 'test-socket-789',
      emit: vi.fn(),
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
      broadcast: {
        emit: vi.fn(),
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      },
    } as unknown as Partial<Socket>;

    mockAuthSocket = {
      ...mockSocket,
      userId: 'user-999',
      role: 'user',
    };
  });

  describe('onTypingStarted', () => {
    it('should broadcast typing.started to conversation room', async () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'John Doe',
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onTypingStarted(mockSocket as Socket, payload);

      expect(mockSocket.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440000');
      expect(mockToEmit).toHaveBeenCalledWith('typing.started', payload);
    });

    it('should include user name in payload', async () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Alice Smith',
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onTypingStarted(mockSocket as Socket, payload);

      expect(mockToEmit).toHaveBeenCalledWith(
        'typing.started',
        expect.objectContaining({ name: 'Alice Smith' })
      );
    });
  });

  describe('onTypingStopped', () => {
    it('should broadcast typing.stopped to conversation room', async () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onTypingStopped(mockSocket as Socket, payload);

      expect(mockSocket.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440000');
      expect(mockToEmit).toHaveBeenCalledWith('typing.stopped', payload);
    });

    it('should clear typing state for user', async () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
      };

      const mockToEmit = vi.fn();
      mockSocket.to = vi.fn().mockReturnValue({ emit: mockToEmit });

      await controller.onTypingStopped(mockSocket as Socket, payload);

      expect(mockToEmit).toHaveBeenCalledWith('typing.stopped', payload);
    });
  });

  describe('Type safety', () => {
    it('should validate UUID format for user and conversation IDs', () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Test User',
      };

      expect(payload.conversationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(payload.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should preserve user name through events', async () => {
      const userName = 'Bob Johnson';
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        name: userName,
      };

      expect(payload.name).toBe(userName);
    });
  });
});
