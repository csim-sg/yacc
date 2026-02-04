/**
 * WebSocket Server Setup
 *
 * Initializes and configures Socket.io server for real-time updates
 */

import { Server } from 'socket.io';
import { webSocketAuthMiddleware } from './auth.middleware';
import { logger } from '../infrastructure/logger';
import { config } from '../config/config';
import { PING_INTERVAL_MS, CONNECTION_TIMEOUT_MS } from './wsConstants';

/**
 * WebSocket server class
 *
 * Manages Socket.io server lifecycle, authentication, and client connections
 */
export class WebSocketServer {
  private io: Server;
  private connectedClients: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs

  /**
   * Initialize WebSocket server
   */
  constructor(httpServer: any) {
    this.io = new Server(httpServer, {
      cors: {
        origin: config.frontend.url,
        credentials: true,
      },
      pingTimeout: PING_INTERVAL_MS,
      pingInterval: PING_INTERVAL_MS,
      transports: ['websocket'],
      allowUpgrades: true,
    });

    this.setupAuthentication();
    this.setupEventHandlers();
    this.setupCleanup();
  }

  /**
   * Get Socket.io server instance
   */
  getServer(): Server {
    return this.io;
  }

  /**
   * Setup authentication middleware
   */
  private setupAuthentication(): void {
    this.io.use(webSocketAuthMiddleware);
    logger.info('WebSocket authentication middleware configured');
  }

  /**
   * Setup core connection event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: any) => {
      logger.info({
        socketId: socket.id,
        userId: socket.userId,
        role: socket.role,
      }, 'WebSocket client connected');

      // Track user connection
      if (socket.userId) {
        this.trackConnection(socket.userId, socket.id);
      }

      // Join user's personal room for targeted updates
      if (socket.userId) {
        socket.join(`user:${socket.userId}`);
      }

      // Send connection success event to client
      socket.emit('connection.established', {
        socketId: socket.id,
        timestamp: new Date().toISOString(),
      });

      // Handle disconnect
      socket.on('disconnect', (reason: string) => {
        this.handleDisconnect(socket, reason);
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        logger.error({
          socketId: socket.id,
          userId: socket.userId,
          error: error.message,
        }, 'WebSocket error');
      });
    });

    logger.info('WebSocket event handlers configured');
  }

  /**
   * Setup periodic cleanup tasks
   */
  private setupCleanup(): void {
    // Ping/heartbeat is handled by Socket.io automatically
    logger.info('WebSocket ping/heartbeat configured', {
      interval: PING_INTERVAL_MS,
      timeout: CONNECTION_TIMEOUT_MS,
    });
  }

  /**
   * Track user connection (for presence)
   *
   * @param userId - User ID
   * @param socketId - Socket ID
   */
  private trackConnection(userId: string, socketId: string): void {
    if (!this.connectedClients.has(userId)) {
      this.connectedClients.set(userId, new Set());
    }
    this.connectedClients.get(userId)!.add(socketId);
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnect(socket: any, reason: string): void {
    logger.info({
      socketId: socket.id,
      userId: socket.userId,
      reason,
    }, 'WebSocket client disconnected');

    // Remove connection tracking
    if (socket.userId) {
      const userConnections = this.connectedClients.get(socket.userId);
      if (userConnections) {
        userConnections.delete(socket.id);
        if (userConnections.size === 0) {
          this.connectedClients.delete(socket.userId);
          // Broadcast presence update
          this.broadcastPresenceUpdate(socket.userId, false);
        }
      }
    }
  }

  /**
   * Broadcast presence update to all connected clients
   *
   * @param userId - User ID who changed presence
   * @param isOnline - Online status
   */
  private broadcastPresenceUpdate(userId: string, isOnline: boolean): void {
    this.io.emit('presence.updated', {
      userId,
      isOnline,
      timestamp: new Date().toISOString(),
    });
    logger.debug({ userId, isOnline }, 'Broadcasted presence update');
  }

  /**
   * Send event to specific user
   *
   * @param userId - Target user ID
   * @param event - Event name
   * @param data - Event data
   */
  sendToUser(userId: string, event: string, data: any): void {
    const room = `user:${userId}`;
    this.io.to(room).emit(event, data);
    logger.debug({ userId, event }, 'Sent event to user');
  }

  /**
   * Broadcast event to all connected clients
   *
   * @param event - Event name
   * @param data - Event data
   */
  broadcast(event: string, data: any): void {
    this.io.emit(event, data);
    logger.debug({ event }, 'Broadcasted event to all clients');
  }

  /**
   * Get number of connected users
   */
  getConnectedUserCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get all connected user IDs
   */
  getConnectedUserIds(): string[] {
    return Array.from(this.connectedClients.keys());
  }
}
