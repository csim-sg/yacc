/**
 * Reaction Socket Controller
 *
 * Handles real-time message reactions (emoji reactions)
 * Uses socket-controllers for declarative event handling
 */

import { SocketController, OnMessage } from 'socket-controllers';
import type { Socket } from 'socket.io';
import { logger } from '../infrastructure/logger';
import type { ReactionAddedPayload, ReactionRemovedPayload } from '../types/websocket.types';

@SocketController()
export class ReactionController {
  /**
   * Emit reaction.added event when user adds emoji reaction to message
   * Broadcast to conversation subscribers
   *
   * @param socket - Socket instance
   * @param payload - Reaction added payload
   */
  @OnMessage('reaction.added')
  async onReactionAdded(socket: Socket, payload: ReactionAddedPayload): Promise<void> {
    const room = `conversation:${payload.conversationId}`;

    try {
      logger.debug({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        emoji: payload.emoji,
        userId: payload.userId,
        room,
      }, 'Emitting reaction.added event');

      // Emit to all subscribers in conversation room
      socket.to(room).emit('reaction.added', payload);

      // Acknowledge to sender
      socket.emit('reaction.added.ack', {
        messageId: payload.messageId,
        emoji: payload.emoji,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        messageId: payload.messageId,
        emoji: payload.emoji,
        error: errorMessage,
      }, 'Failed to emit reaction.added');
      throw error;
    }
  }

  /**
   * Emit reaction.removed event when user removes emoji reaction from message
   * Broadcast to conversation subscribers
   *
   * @param socket - Socket instance
   * @param payload - Reaction removed payload
   */
  @OnMessage('reaction.removed')
  async onReactionRemoved(socket: Socket, payload: ReactionRemovedPayload): Promise<void> {
    const room = `conversation:${payload.conversationId}`;

    try {
      logger.debug({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        emoji: payload.emoji,
        userId: payload.userId,
        room,
      }, 'Emitting reaction.removed event');

      // Emit to all subscribers in conversation room
      socket.to(room).emit('reaction.removed', payload);

      // Acknowledge to sender
      socket.emit('reaction.removed.ack', {
        messageId: payload.messageId,
        emoji: payload.emoji,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        messageId: payload.messageId,
        emoji: payload.emoji,
        error: errorMessage,
      }, 'Failed to emit reaction.removed');
      throw error;
    }
  }

  /**
   * Get all reactions for a message
   * Client requests reaction summary for a message
   *
   * @param socket - Socket instance
   * @param data - Request data with messageId
   */
  @OnMessage('reaction.list')
  async onReactionList(socket: Socket, data: { messageId: string }): Promise<void> {
    try {
      logger.debug({
        messageId: data.messageId,
      }, 'Client requesting reaction list');

      // In a real implementation, fetch reactions from database
      // For now, just acknowledge - actual reactions are emitted via reaction.added/removed
      socket.emit('reaction.list.ack', {
        messageId: data.messageId,
        reactions: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        messageId: data.messageId,
        error: errorMessage,
      }, 'Failed to handle reaction.list');
      socket.emit('error', {
        message: 'Failed to fetch reactions',
      });
    }
  }

  /**
   * Handle reaction count update
   * Tracks aggregated reaction counts per emoji
   *
   * @param socket - Socket instance
   * @param data - Reaction count data
   */
  @OnMessage('reaction.count')
  async onReactionCount(
    socket: Socket,
    data: {
      messageId: string;
      conversationId: string;
      emoji: string;
      count: number;
    }
  ): Promise<void> {
    const room = `conversation:${data.conversationId}`;

    try {
      logger.debug({
        messageId: data.messageId,
        emoji: data.emoji,
        count: data.count,
      }, 'Emitting reaction.count event');

      // Broadcast reaction count to conversation subscribers
      socket.to(room).emit('reaction.count', {
        messageId: data.messageId,
        emoji: data.emoji,
        count: data.count,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        messageId: data.messageId,
        emoji: data.emoji,
        error: errorMessage,
      }, 'Failed to emit reaction.count');
      throw error;
    }
  }
}
