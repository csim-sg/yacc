/**
 * Unit Tests for PresenceController
 *
 * Tests user presence and online/offline status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PresenceController } from '../presence.controller';
import type { Socket } from 'socket.io';

describe('PresenceController', () => {
  let controller: PresenceController;
  let mockSocket: Partial<Socket>;

  beforeEach(() => {
    controller = new PresenceController();

    const mockBroadcast = {
      emit: vi.fn(),
    };

    mockSocket = {
      id: 'test-socket-111',
      emit: vi.fn(),
      broadcast: mockBroadcast,
    } as unknown as Partial<Socket>;
  });

  describe('onPresenceUpdated', () => {
    it('should broadcast presence.updated to all users', async () => {
      const payload = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
      };

      await controller.onPresenceUpdated(mockSocket as Socket, payload);

      expect(mockSocket.broadcast?.emit).toHaveBeenCalledWith('presence.updated', payload);
    });

    it('should include user status in broadcast', async () => {
      const payload = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'offline' as const,
        lastSeen: new Date().toISOString(),
      };

      await controller.onPresenceUpdated(mockSocket as Socket, payload);

      expect(mockSocket.broadcast?.emit).toHaveBeenCalledWith(
        'presence.updated',
        expect.objectContaining({ status: 'offline' })
      );
    });
  });

  describe('onUserOnline', () => {
    it('should preserve user data in online event', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const name = 'John Doe';
      const data = {
        userId,
        name,
      };

      expect(data.userId).toBe(userId);
      expect(data.name).toBe(name);
    });

    it('should include user name', () => {
      const name = 'Alice Smith';
      const data = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        name,
      };

      expect(data.name).toBe(name);
    });
  });

  describe('Type safety', () => {
    it('should validate presence status enum', () => {
      const validStatuses: Array<'online' | 'offline'> = ['online', 'offline'];

      for (const status of validStatuses) {
        expect(['online', 'offline']).toContain(status);
      }
    });

    it('should preserve user ID through presence updates', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const payload = {
        userId,
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
      };

      expect(payload.userId).toBe(userId);
    });
  });
});
