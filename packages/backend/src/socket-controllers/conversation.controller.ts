/**
 * Conversation Socket Controller
 *
 * Handles real-time conversation events
 * Uses socket-controllers for declarative event handling
 */

import { SocketController, OnConnect, OnDisconnect, OnMessage } from 'socket-controllers';
import type { Socket } from 'socket.io';
import { logger } from '../infrastructure/logger';
import type { AuthenticatedSocket } from '../websockets/auth.middleware';
import type { ConversationUpdatedPayload } from '../types/websocket.types';

@SocketController()
export class ConversationController {
  /**
   * Lifecycle: When client connects
   * Join conversation-related rooms and broadcast presence
   * Auth middleware ensures user is authenticated before this fires
   */
  @OnConnect()
  onConnect(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;
    const userRole = authSocket.role;

    logger.debug({
      socketId: socket.id,
      userId,
      userRole,
    }, 'Connection lifecycle - client connected');

    // Join user's personal room
    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Emit connection established
    socket.emit('connection.established', {
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Lifecycle: When client disconnects
   * Clean up user presence and remove from rooms
   */
  @OnDisconnect()
  onDisconnect(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;
    
    logger.debug({
      socketId: socket.id,
      userId,
    }, 'Lifecycle - client disconnected');

    // Broadcast offline status
    if (userId) {
      socket.broadcast.emit('presence.updated', {
        userId,
        status: 'offline',
        lastSeen: new Date().toISOString(),
      });
    }
  }

  /**
   * Handle conversation.updated event
   * Called when conversation status/priority/assignment changes
   * Broadcasts update to all subscribers in conversation room
   *
   * @param socket - Socket instance
   * @param payload - Updated conversation data
   */
  @OnMessage('conversation.updated')
  async onConversationUpdated(socket: Socket, payload: ConversationUpdatedPayload): Promise<void> {
    const room = `conversation:${payload.conversationId}`;

    try {
      logger.debug({
        conversationId: payload.conversationId,
        room,
        changedBy: payload.changedBy,
      }, 'Broadcasting conversation.updated event');

      // Emit to all subscribers in conversation room (except sender)
      socket.to(room).emit('conversation.updated', payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        conversationId: payload.conversationId,
        error: errorMessage,
      }, 'Failed to emit conversation.updated');
      throw error;
    }
  }

  /**
   * Subscribe client to a specific conversation room
   * Allows client to receive updates for that conversation
   *
   * @param socket - Socket instance
   * @param conversationId - Conversation to subscribe to
   */
  @OnMessage('subscribe.conversation')
  async onSubscribeToConversation(socket: Socket, conversationId: string): Promise<void> {
    const room = `conversation:${conversationId}`;

    try {
      socket.join(room);
      logger.debug({
        socketId: socket.id,
        conversationId,
        room,
      }, 'Client subscribed to conversation');

      // Acknowledge subscription
      socket.emit('conversation.subscribed', { conversationId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        conversationId,
        error: errorMessage,
      }, 'Failed to subscribe to conversation');
      throw error;
    }
  }

  /**
   * Unsubscribe client from a conversation room
   *
   * @param socket - Socket instance
   * @param conversationId - Conversation to unsubscribe from
   */
  @OnMessage('unsubscribe.conversation')
  async onUnsubscribeFromConversation(socket: Socket, conversationId: string): Promise<void> {
    const room = `conversation:${conversationId}`;

    try {
      socket.leave(room);
      logger.debug({
        socketId: socket.id,
        conversationId,
        room,
      }, 'Client unsubscribed from conversation');

      // Acknowledge unsubscription
      socket.emit('conversation.unsubscribed', { conversationId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        conversationId,
        error: errorMessage,
      }, 'Failed to unsubscribe from conversation');
      throw error;
    }
  }
}
