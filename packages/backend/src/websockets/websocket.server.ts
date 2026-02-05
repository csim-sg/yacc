/**
 * WebSocket Server Setup
 *
 * Initializes and configures Socket.io server for real-time updates
 * Manages client connections, room subscriptions, and event broadcasting
 */

import { Server, Socket } from 'socket.io';
import { webSocketAuthMiddleware } from './auth.middleware';
import { logger } from '../infrastructure/logger';
import { appConfig } from '../config/appConfig';
import { PING_INTERVAL_MS, CONNECTION_TIMEOUT_MS } from './wsConstants';
import type { WebSocketEventMap } from '../types/websocket.types';

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
         origin: appConfig.APP_FRONTEND_URL,
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
    logger.info('WebSocket ping/heartbeat configured - interval: %d ms, timeout: %d ms', PING_INTERVAL_MS, CONNECTION_TIMEOUT_MS);
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

   // ============================================
   // Conversation Room Subscription Methods
   // ============================================

   /**
    * Subscribe a user to a conversation room
    *
    * @param userId - User ID
    * @param conversationId - Conversation ID to subscribe to
    */
   subscribeToConversation(userId: string, conversationId: string): void {
     const room = `conversation:${conversationId}`;
     const userSockets = this.connectedClients.get(userId);

     if (!userSockets || userSockets.size === 0) {
       logger.warn('Cannot subscribe user to conversation: user not connected - userId: %s', userId);
       return;
     }

     // Join all user's sockets to the conversation room
     userSockets.forEach((socketId) => {
       this.io.sockets.sockets.get(socketId)?.join(room);
     });

     logger.debug(
       'User subscribed to conversation - userId: %s, conversationId: %s, room: %s, socketCount: %d',
       userId,
       conversationId,
       room,
       userSockets.size
     );
   }

   /**
    * Unsubscribe a user from a conversation room
    *
    * @param userId - User ID
    * @param conversationId - Conversation ID to unsubscribe from
    */
   unsubscribeFromConversation(userId: string, conversationId: string): void {
     const room = `conversation:${conversationId}`;
     const userSockets = this.connectedClients.get(userId);

     if (!userSockets) {
       return;
     }

     // Leave conversation room for all user's sockets
     userSockets.forEach((socketId) => {
       this.io.sockets.sockets.get(socketId)?.leave(room);
     });

     logger.debug(
       'User unsubscribed from conversation - userId: %s, conversationId: %s',
       userId,
       conversationId
     );
   }

   /**
    * Check if a user is subscribed to a conversation
    *
    * @param userId - User ID
    * @param conversationId - Conversation ID
    * @returns True if user is subscribed
    */
   isSubscribedToConversation(userId: string, conversationId: string): boolean {
     const room = `conversation:${conversationId}`;
     const userSockets = this.connectedClients.get(userId);

     if (!userSockets || userSockets.size === 0) {
       return false;
     }

     // Check if any of user's sockets are in the room
     for (const socketId of userSockets) {
       const socket = this.io.sockets.sockets.get(socketId);
       if (socket?.rooms.has(room)) {
         return true;
       }
     }

     return false;
   }

   /**
    * Get all users subscribed to a conversation
    *
    * @param conversationId - Conversation ID
    * @returns Set of user IDs subscribed to this conversation
    */
   getConversationSubscribers(conversationId: string): Set<string> {
     const room = `conversation:${conversationId}`;
     const subscribers = new Set<string>();

     // Find all sockets in the room and map to their users
     this.connectedClients.forEach((sockets, userId) => {
       for (const socketId of sockets) {
         const socket = this.io.sockets.sockets.get(socketId);
         if (socket?.rooms.has(room)) {
           subscribers.add(userId);
           break; // Only need to find one socket per user
         }
       }
     });

     return subscribers;
   }

   // ============================================
   // Event Emission Methods (Type-Safe)
   // ============================================

   /**
    * Emit a type-safe event to a conversation room
    *
    * @param conversationId - Conversation ID
    * @param eventName - Event name (type-checked)
    * @param payload - Event payload (type-checked)
    */
   emitToConversation<K extends keyof WebSocketEventMap>(
     conversationId: string,
     eventName: K,
     payload: WebSocketEventMap[K]
   ): void {
     const room = `conversation:${conversationId}`;
     this.io.to(room).emit(eventName, payload);
     logger.debug(
       'Emitted event to conversation - conversationId: %s, event: %s',
       conversationId,
       eventName
     );
   }

   /**
    * Emit a type-safe event to a specific user
    *
    * @param userId - User ID
    * @param eventName - Event name (type-checked)
    * @param payload - Event payload (type-checked)
    */
   emitToUser<K extends keyof WebSocketEventMap>(
     userId: string,
     eventName: K,
     payload: WebSocketEventMap[K]
   ): void {
     const room = `user:${userId}`;
     this.io.to(room).emit(eventName, payload);
     logger.debug(
       'Emitted event to user - userId: %s, event: %s',
       userId,
       eventName
     );
   }

   /**
    * Broadcast a type-safe event globally to all connected clients
    *
    * @param eventName - Event name (type-checked)
    * @param payload - Event payload (type-checked)
    */
   emitGlobally<K extends keyof WebSocketEventMap>(
     eventName: K,
     payload: WebSocketEventMap[K]
   ): void {
     this.io.emit(eventName, payload);
     logger.debug('Broadcasted event globally - event: %s', eventName);
   }
}
