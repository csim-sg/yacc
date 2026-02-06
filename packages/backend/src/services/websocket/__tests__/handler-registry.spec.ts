/**
 * WebSocket Handler Registry Unit Tests
 *
 * Tests the event handler registry, type-safe emission, and handler discovery
 *
 * NOTE: These tests mock logger to avoid appConfig environment variable requirements
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Server } from 'socket.io';

// Mock logger to avoid appConfig parsing
vi.mock('../../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  emitEvent,
  getRegisteredEvents,
  isEventRegistered,
} from '../handler-registry';

/**
 * Mock Socket.io server
 */
const createMockIO = (): Server => {
  return {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
    on: vi.fn(),
  } as unknown as Server;
};

describe('Handler Registry', () => {
  let mockIO: Server;

  beforeEach(() => {
    mockIO = createMockIO();
    vi.clearAllMocks();
  });

  // ============================================
  // Registration Tests
  // ============================================

  describe('getRegisteredEvents', () => {
    it('should return all 8 registered event names', () => {
      const events = getRegisteredEvents();

      expect(events).toHaveLength(8);
      expect(events).toContain('conversation.updated');
      expect(events).toContain('message.sent');
      expect(events).toContain('message.failed');
      expect(events).toContain('typing.started');
      expect(events).toContain('typing.stopped');
      expect(events).toContain('presence.updated');
      expect(events).toContain('reaction.added');
      expect(events).toContain('reaction.removed');
    });
  });

  // ============================================
  // Event Registration Check Tests
  // ============================================

  describe('isEventRegistered', () => {
    it('should return true for registered events', () => {
      expect(isEventRegistered('conversation.updated')).toBe(true);
      expect(isEventRegistered('message.sent')).toBe(true);
      expect(isEventRegistered('typing.started')).toBe(true);
      expect(isEventRegistered('presence.updated')).toBe(true);
      expect(isEventRegistered('reaction.added')).toBe(true);
    });

    it('should return false for unregistered events', () => {
      expect(isEventRegistered('unknown.event')).toBe(false);
      expect(isEventRegistered('custom.event')).toBe(false);
      expect(isEventRegistered('')).toBe(false);
    });
  });

  // ============================================
  // Type-Safe Emission Tests
  // ============================================

  describe('emitEvent', () => {
    it('should emit conversation.updated with correct payload', async () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        updatedFields: { status: 'pending' },
        changedBy: '550e8400-e29b-41d4-a716-446655440001',
        changedAt: new Date().toISOString(),
      };

      await emitEvent(mockIO, 'conversation.updated', payload);

      expect(mockIO.to).toHaveBeenCalled();
      expect(mockIO.emit).toHaveBeenCalled();
    });

    it('should emit message.sent with correct payload', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      await emitEvent(mockIO, 'message.sent', payload);

      expect(mockIO.to).toHaveBeenCalled();
      expect(mockIO.emit).toHaveBeenCalled();
    });

    it('should emit message.failed with correct payload', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'failed' as const,
        error: 'Network error',
        retryAt: new Date().toISOString(),
        attempt: 1,
      };

      await emitEvent(mockIO, 'message.failed', payload);

      expect(mockIO.to).toHaveBeenCalled();
      expect(mockIO.emit).toHaveBeenCalled();
    });

    it('should emit typing.started with correct payload', async () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'John Doe',
      };

      await emitEvent(mockIO, 'typing.started', payload);

      expect(mockIO.to).toHaveBeenCalled();
      expect(mockIO.emit).toHaveBeenCalled();
    });

    it('should emit typing.stopped with correct payload', async () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
      };

      await emitEvent(mockIO, 'typing.stopped', payload);

      expect(mockIO.to).toHaveBeenCalled();
      expect(mockIO.emit).toHaveBeenCalled();
    });

    it('should emit presence.updated with correct payload', async () => {
      const payload = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
      };

      await emitEvent(mockIO, 'presence.updated', payload);

      expect(mockIO.emit).toHaveBeenCalled();
    });

    it('should emit reaction.added with correct payload', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        emoji: '👍',
        userId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Jane Doe',
      };

      await emitEvent(mockIO, 'reaction.added', payload);

      expect(mockIO.to).toHaveBeenCalled();
      expect(mockIO.emit).toHaveBeenCalled();
    });

    it('should emit reaction.removed with correct payload', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        emoji: '👍',
        userId: '550e8400-e29b-41d4-a716-446655440002',
      };

      await emitEvent(mockIO, 'reaction.removed', payload);

      expect(mockIO.to).toHaveBeenCalled();
      expect(mockIO.emit).toHaveBeenCalled();
    });

    it('should reject invalid payload for message.sent', async () => {
      const payload = {
        messageId: 'invalid-id',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      await expect(emitEvent(mockIO, 'message.sent', payload as any)).rejects.toThrow();
    });

    it('should reject invalid payload for presence.updated', async () => {
      const payload = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'away',
        lastSeen: new Date().toISOString(),
      };

      await expect(emitEvent(mockIO, 'presence.updated', payload as any)).rejects.toThrow();
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('emitEvent error handling', () => {
    it('should handle handler execution errors gracefully', async () => {
      // Mock IO to throw error during emit
      const errorIO = {
        to: vi.fn().mockReturnThis(),
        emit: vi.fn().mockImplementation(() => {
          throw new Error('Socket.io emit failed');
        }),
      } as unknown as Server;

      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'John Doe',
      };

      await expect(emitEvent(errorIO, 'typing.started', payload)).rejects.toThrow();
    });
  });
});
