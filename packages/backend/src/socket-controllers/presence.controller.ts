/**
 * Presence Socket Controller
 *
 * Handles real-time user presence (online/offline status)
 * Uses socket-controllers for declarative event handling
 */

import { SocketController, OnMessage } from 'socket-controllers';
import type { Socket, Server } from 'socket.io';
import { logger } from '../infrastructure/logger';
import type { PresenceUpdatedPayload } from '../types/websocket.types';
import type { AuthenticatedSocket } from '../websockets/auth.middleware';

@SocketController()
export class PresenceController {
  /**
   * Emit presence.updated event when user status changes
   * Broadcast to all users
   *
   * @param socket - Socket instance
   * @param payload - Presence updated payload
   */
  @OnMessage('presence.updated')
  async onPresenceUpdated(socket: Socket, payload: PresenceUpdatedPayload): Promise<void> {
    try {
      logger.debug({
        userId: payload.userId,
        status: payload.status,
      }, 'Emitting presence.updated event');

      // Broadcast to all connected users
      socket.broadcast.emit('presence.updated', payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        userId: payload.userId,
        error: errorMessage,
      }, 'Failed to emit presence.updated');
      throw error;
    }
  }

  /**
   * Handle user coming online
   * Triggered on successful connection
   *
   * @param socket - Socket instance
   * @param data - User online data
   */
  @OnMessage('user.online')
  async onUserOnline(socket: Socket, data: { userId: string; name: string }): Promise<void> {
    try {
      logger.debug({
        userId: data.userId,
        name: data.name,
        socketId: socket.id,
      }, 'User coming online');

      // Broadcast presence to all users
      socket.broadcast.emit('presence.updated', {
        userId: data.userId,
        status: 'online',
        lastSeen: new Date().toISOString(),
      });

      // Send current online users to the connecting user
      const onlineUsers = await this.getOnlineUsers(socket);
      socket.emit('online.users', {
        users: onlineUsers,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        userId: data.userId,
        error: errorMessage,
      }, 'Failed to handle user.online');
      throw error;
    }
  }

  /**
   * Handle user going offline
   * Triggered on disconnection
   *
   * @param socket - Socket instance
   * @param data - User offline data
   */
  @OnMessage('user.offline')
  async onUserOffline(socket: Socket, data: { userId: string }): Promise<void> {
    try {
      logger.debug({
        userId: data.userId,
        socketId: socket.id,
      }, 'User going offline');

      // Broadcast presence to all remaining users
      socket.broadcast.emit('presence.updated', {
        userId: data.userId,
        status: 'offline',
        lastSeen: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        userId: data.userId,
        error: errorMessage,
      }, 'Failed to handle user.offline');
      throw error;
    }
  }

  /**
   * Handle user status update (idle/active)
   * Allows granular presence tracking beyond online/offline
   *
   * @param socket - Socket instance
   * @param data - User status update data
   */
  @OnMessage('user.status')
  async onUserStatus(
    socket: Socket,
    data: { userId: string; status: 'active' | 'idle' | 'away' }
  ): Promise<void> {
    try {
      logger.debug({
        userId: data.userId,
        status: data.status,
      }, 'User status updated');

      // Broadcast status to conversation subscribers
      socket.broadcast.emit('user.status.changed', {
        userId: data.userId,
        status: data.status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        userId: data.userId,
        error: errorMessage,
      }, 'Failed to handle user.status');
      throw error;
    }
  }

  /**
   * Request online users list
   * Client requests current list of online users
   *
   * @param socket - Socket instance
   */
  @OnMessage('request.online.users')
  async onRequestOnlineUsers(socket: Socket): Promise<void> {
    try {
      logger.debug({
        socketId: socket.id,
      }, 'Client requesting online users list');

      const onlineUsers = await this.getOnlineUsers(socket);
      socket.emit('online.users', {
        users: onlineUsers,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        error: errorMessage,
      }, 'Failed to get online users');
      socket.emit('error', {
        message: 'Failed to fetch online users',
      });
    }
  }

  /**
   * Get list of online users
   * Helper method to get user IDs from all connected sockets
   *
   * @param socket - Socket instance
   * @returns Array of online user IDs
   */
  private async getOnlineUsers(socket: Socket): Promise<string[]> {
    try {
      // Get all connected sockets using the Socket.IO server instance
      const io: Server = socket.nsp.server;
      const sockets = await io.fetchSockets();
      const onlineUserIds = new Set<string>();

      // Extract unique user IDs from sockets
      // Auth middleware attaches userId as a property on socket
      for (const connectedSocket of sockets) {
        // Type-safe extraction: check for userId property
        const socketWithAuth = connectedSocket as unknown as AuthenticatedSocket;
        const userId = socketWithAuth.userId;
        if (userId && typeof userId === 'string') {
          onlineUserIds.add(userId);
        }
      }

      return Array.from(onlineUserIds);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        error: errorMessage,
      }, 'Failed to fetch connected sockets');
      throw error;
    }
  }
}
