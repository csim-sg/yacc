import type { Server as SocketIOServer } from 'socket.io';
import { logger } from '../infrastructure/logger';
import type { WebSocketEventType } from './wsConstants';

/**
 * WebSocket Gateway
 *
 * Centralized service for emitting WebSocket events to connected clients.
 * Manages event broadcasting with proper error handling and logging.
 *
 * Usage:
 *   wsGateway.initialize(io)  // Call once on startup with Socket.io instance
 *   wsGateway.emitGlobally('message.sent', { messageId: '123', ... })
 *   wsGateway.emitToUser(userId, 'notification.received', { ... })
 */

class WebSocketGateway {
  private io: SocketIOServer | null = null;
  private isInitialized = false;

  /**
   * Initialize gateway with Socket.io instance
   *
   * Must be called once during application startup
   *
   * @param ioInstance - Socket.io Server instance
   */
  initialize(ioInstance: SocketIOServer): void {
    if (this.isInitialized) {
      logger.warn('WebSocket gateway already initialized');
      return;
    }

    this.io = ioInstance;
    this.isInitialized = true;

    logger.info('WebSocket gateway initialized');

    // Setup connection handlers
    this.io.on('connection', (socket) => {
      logger.debug({ socketId: socket.id }, 'WebSocket client connected');

      socket.on('disconnect', () => {
        logger.debug({ socketId: socket.id }, 'WebSocket client disconnected');
      });

      socket.on('error', (error) => {
        logger.error({ socketId: socket.id, error }, 'WebSocket client error');
      });
    });
  }

  /**
   * Check if gateway is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.io !== null;
  }

  /**
   * Emit event globally to all connected clients
   *
   * @param event - Event name (dot notation)
   * @param data - Event payload
   */
  emitGlobally<T extends WebSocketEventType>(event: T, data: unknown): void {
    if (!this.isReady()) {
      logger.warn({ event }, 'WebSocket gateway not initialized, skipping emit');
      return;
    }

    try {
      this.io?.emit(event, {
        event,
        data,
        timestamp: new Date().toISOString(),
      });

      logger.debug(
        {
          event,
          clientCount: this.io?.engine.clientsCount || 0,
        },
        'Event emitted globally'
      );
    } catch (error) {
      logger.error({ error, event }, 'Failed to emit global event');
    }
  }

  /**
   * Emit event to specific user
   *
   * Emits to all connections associated with userId
   *
   * @param userId - User ID to emit to
   * @param event - Event name (dot notation)
   * @param data - Event payload
   */
  emitToUser(userId: string, event: WebSocketEventType, data: unknown): void {
    if (!this.isReady()) {
      logger.warn({ userId, event }, 'WebSocket gateway not initialized, skipping emit');
      return;
    }

    try {
      this.io?.to(`user:${userId}`).emit(event, {
        event,
        data,
        timestamp: new Date().toISOString(),
      });

      logger.debug(
        { userId, event },
        'Event emitted to user'
      );
    } catch (error) {
      logger.error({ error, userId, event }, 'Failed to emit user event');
    }
  }

  /**
   * Emit event to specific conversation
   *
   * Emits to all clients watching the conversation
   *
   * @param conversationId - Conversation ID
   * @param event - Event name (dot notation)
   * @param data - Event payload
   */
  emitToConversation(
    conversationId: string,
    event: WebSocketEventType,
    data: unknown
  ): void {
    if (!this.isReady()) {
      logger.warn(
        { conversationId, event },
        'WebSocket gateway not initialized, skipping emit'
      );
      return;
    }

    try {
      this.io?.to(`conversation:${conversationId}`).emit(event, {
        event,
        data,
        timestamp: new Date().toISOString(),
      });

      logger.debug(
        { conversationId, event },
        'Event emitted to conversation'
      );
    } catch (error) {
      logger.error(
        { error, conversationId, event },
        'Failed to emit conversation event'
      );
    }
  }

  /**
   * Broadcast to multiple rooms
   *
   * @param rooms - Array of room names
   * @param event - Event name
   * @param data - Event payload
   */
  emitToRooms(rooms: string[], event: WebSocketEventType, data: unknown): void {
    if (!this.isReady()) {
      logger.warn({ rooms, event }, 'WebSocket gateway not initialized, skipping emit');
      return;
    }

    try {
      for (const room of rooms) {
        this.io?.to(room).emit(event, {
          event,
          data,
          timestamp: new Date().toISOString(),
        });
      }

      logger.debug(
        { roomCount: rooms.length, event },
        'Event emitted to rooms'
      );
    } catch (error) {
      logger.error({ error, rooms, event }, 'Failed to emit room event');
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    initialized: boolean;
    clientCount: number;
    rooms: number;
  } {
    return {
      initialized: this.isReady(),
      clientCount: this.io?.engine.clientsCount || 0,
      rooms: this.io?.sockets.adapter?.rooms?.size || 0,
    };
  }

  /**
   * Get list of connected clients
   */
  getConnectedClients(): string[] {
    if (!this.isReady()) {
      return [];
    }

    return Array.from(this.io?.sockets.sockets.keys() || []);
  }

  /**
   * Disconnect a specific client
   */
  disconnectClient(socketId: string): void {
    if (!this.isReady()) {
      logger.warn({ socketId }, 'WebSocket gateway not initialized');
      return;
    }

    try {
      this.io?.sockets.sockets.get(socketId)?.disconnect();
      logger.info({ socketId }, 'Client disconnected');
    } catch (error) {
      logger.error({ error, socketId }, 'Failed to disconnect client');
    }
  }
}

// Export singleton instance
export const wsGateway = new WebSocketGateway();
