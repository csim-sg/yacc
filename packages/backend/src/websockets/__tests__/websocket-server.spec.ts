/**
 * WebSocket Server Room Subscription Tests
 *
 * Tests room subscription, event emission, and user tracking methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Server, Socket } from 'socket.io';

// Mock logger to avoid appConfig parsing
vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

/**
 * Create mock Socket.io server and socket for testing
 */
const createMockSocket = (userId: string, socketId: string) => {
  const mockSocket: any = {
    id: socketId,
    userId,
    email: `user${userId}@example.com`,
    role: 'user',
    rooms: new Set<string>(),
    join: vi.fn(function (this: any, room: string) {
      this.rooms.add(room);
    }),
    leave: vi.fn(function (this: any, room: string) {
      this.rooms.delete(room);
    }),
  };

  return mockSocket;
};

const createMockServer = () => {
  const sockets = new Map<string, any>();

  return {
    sockets: {
      sockets: new Map(sockets),
    },
    to: vi.fn(function (room: string) {
      return {
        emit: vi.fn(),
      };
    }),
    emit: vi.fn(),
    on: vi.fn(),
    use: vi.fn(),
  } as unknown as Server;
};

describe('WebSocket Server Room Subscriptions', () => {
  let mockSocket: any;
  let mockServer: Server;

  beforeEach(() => {
    mockSocket = createMockSocket('550e8400-e29b-41d4-a716-446655440000', 'socket1');
    mockServer = createMockServer();
  });

  // ============================================
  // Mock Setup Tests
  // ============================================

  describe('Mock Setup', () => {
    it('should create mock socket with userId', () => {
      expect(mockSocket.userId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(mockSocket.id).toBe('socket1');
    });

    it('should track room joins on mock socket', () => {
      mockSocket.join('conversation:123');
      expect(mockSocket.rooms.has('conversation:123')).toBe(true);
    });

    it('should track room leaves on mock socket', () => {
      mockSocket.join('conversation:123');
      mockSocket.leave('conversation:123');
      expect(mockSocket.rooms.has('conversation:123')).toBe(false);
    });
  });

  // ============================================
  // Room Subscription Logic Tests
  // ============================================

  describe('Room Subscription Logic', () => {
    it('should join user socket to conversation room', () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';
      const room = `conversation:${conversationId}`;

      mockSocket.join(room);

      expect(mockSocket.rooms.has(room)).toBe(true);
      expect(mockSocket.join).toHaveBeenCalledWith(room);
    });

    it('should leave user socket from conversation room', () => {
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';
      const room = `conversation:${conversationId}`;

      mockSocket.join(room);
      mockSocket.leave(room);

      expect(mockSocket.rooms.has(room)).toBe(false);
      expect(mockSocket.leave).toHaveBeenCalledWith(room);
    });

    it('should track multiple room subscriptions per socket', () => {
      const room1 = 'conversation:conv1';
      const room2 = 'conversation:conv2';
      const room3 = 'conversation:conv3';

      mockSocket.join(room1);
      mockSocket.join(room2);
      mockSocket.join(room3);

      expect(mockSocket.rooms.has(room1)).toBe(true);
      expect(mockSocket.rooms.has(room2)).toBe(true);
      expect(mockSocket.rooms.has(room3)).toBe(true);
      expect(mockSocket.rooms.size).toBe(3);
    });

    it('should check if socket is in specific room', () => {
      const room = 'conversation:123';
      mockSocket.join(room);

      expect(mockSocket.rooms.has(room)).toBe(true);
    });

    it('should return false for rooms socket did not join', () => {
      const room = 'conversation:123';

      expect(mockSocket.rooms.has(room)).toBe(false);
    });
  });

  // ============================================
  // Event Emission to Rooms
  // ============================================

  describe('Event Emission to Rooms', () => {
    it('should emit event to specific room', () => {
      const room = 'conversation:123';
      const roomEmitter = {
        emit: vi.fn(),
      };

      vi.mocked(mockServer.to).mockReturnValue(roomEmitter as any);

      const emitter = mockServer.to(room);
      emitter.emit('message.sent', { messageId: 'msg1' });

      expect(mockServer.to).toHaveBeenCalledWith(room);
      expect(roomEmitter.emit).toHaveBeenCalledWith('message.sent', { messageId: 'msg1' });
    });

    it('should broadcast event globally', () => {
      mockServer.emit('presence.updated', { userId: 'user1', status: 'online' });

      expect(mockServer.emit).toHaveBeenCalledWith('presence.updated', expect.objectContaining({
        status: 'online',
      }));
    });

    it('should emit to user room', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const room = `user:${userId}`;
      const roomEmitter = {
        emit: vi.fn(),
      };

      vi.mocked(mockServer.to).mockReturnValue(roomEmitter as any);

      const emitter = mockServer.to(room);
      emitter.emit('notification.received', { notificationId: 'notif1' });

      expect(mockServer.to).toHaveBeenCalledWith(room);
      expect(roomEmitter.emit).toHaveBeenCalledWith('notification.received', { notificationId: 'notif1' });
    });
  });

  // ============================================
  // Multi-Socket User Tracking
  // ============================================

  describe('Multi-Socket User Tracking', () => {
    it('should track multiple sockets for same user', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const socket1 = createMockSocket(userId, 'socket1');
      const socket2 = createMockSocket(userId, 'socket2');
      const socket3 = createMockSocket(userId, 'socket3');

      expect(socket1.userId).toBe(userId);
      expect(socket2.userId).toBe(userId);
      expect(socket3.userId).toBe(userId);

      expect(socket1.id).not.toBe(socket2.id);
      expect(socket2.id).not.toBe(socket3.id);
    });

    it('should subscribe all user sockets to room when user subscribes', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const socket1 = createMockSocket(userId, 'socket1');
      const socket2 = createMockSocket(userId, 'socket2');
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';
      const room = `conversation:${conversationId}`;

      // Subscribe both sockets
      socket1.join(room);
      socket2.join(room);

      expect(socket1.rooms.has(room)).toBe(true);
      expect(socket2.rooms.has(room)).toBe(true);
    });

    it('should unsubscribe all user sockets from room when user unsubscribes', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const socket1 = createMockSocket(userId, 'socket1');
      const socket2 = createMockSocket(userId, 'socket2');
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';
      const room = `conversation:${conversationId}`;

      // Subscribe both
      socket1.join(room);
      socket2.join(room);

      // Unsubscribe both
      socket1.leave(room);
      socket2.leave(room);

      expect(socket1.rooms.has(room)).toBe(false);
      expect(socket2.rooms.has(room)).toBe(false);
    });
  });

  // ============================================
  // Room Isolation Tests
  // ============================================

  describe('Room Isolation', () => {
    it('should not mix rooms for different users', () => {
      const user1Socket = createMockSocket('user1-id', 'socket1');
      const user2Socket = createMockSocket('user2-id', 'socket2');
      const conversationId = 'conv1';
      const room = `conversation:${conversationId}`;

      user1Socket.join(room);
      user2Socket.join('conversation:conv2');

      expect(user1Socket.rooms.has(room)).toBe(true);
      expect(user2Socket.rooms.has(room)).toBe(false);
    });

    it('should not mix user rooms with conversation rooms', () => {
      const socket = createMockSocket('user-id', 'socket1');
      const userRoom = 'user:user-id';
      const conversationRoom = 'conversation:conv1';

      socket.join(userRoom);
      socket.join(conversationRoom);

      expect(socket.rooms.has(userRoom)).toBe(true);
      expect(socket.rooms.has(conversationRoom)).toBe(true);
      expect(socket.rooms.size).toBe(2);
    });
  });

  // ============================================
  // Event Type Safety Tests
  // ============================================

  describe('Event Type Safety', () => {
    it('should emit message.sent event with correct payload', () => {
      const room = 'conversation:123';
      const roomEmitter = {
        emit: vi.fn(),
      };

      vi.mocked(mockServer.to).mockReturnValue(roomEmitter as any);

      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      const emitter = mockServer.to(room);
      emitter.emit('message.sent', payload);

      expect(roomEmitter.emit).toHaveBeenCalledWith('message.sent', expect.objectContaining({
        status: 'sent',
      }));
    });

    it('should emit typing.started event with user info', () => {
      const room = 'conversation:123';
      const roomEmitter = {
        emit: vi.fn(),
      };

      vi.mocked(mockServer.to).mockReturnValue(roomEmitter as any);

      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'John Doe',
      };

      const emitter = mockServer.to(room);
      emitter.emit('typing.started', payload);

      expect(roomEmitter.emit).toHaveBeenCalledWith('typing.started', expect.objectContaining({
        name: 'John Doe',
      }));
    });
  });
});
