/**
 * Message Socket Controller
 *
 * Handles real-time message events (send, receive, failed, retry)
 * Uses socket-controllers for declarative event handling
 */

import { SocketController, OnMessage } from 'socket-controllers';
import type { Socket } from 'socket.io';
import { logger } from '../infrastructure/logger';
import type { MessageSentPayload, MessageFailedPayload } from '../types/websocket.types';

@SocketController()
export class MessageController {
  /**
   * Emit message.sent event to conversation subscribers
   * Called when message successfully delivered to platform
   *
   * @param socket - Socket instance
   * @param payload - Message sent payload
   */
  @OnMessage('message.sent')
  async onMessageSent(socket: Socket, payload: MessageSentPayload): Promise<void> {
    const room = `conversation:${payload.conversationId}`;

    try {
      logger.debug({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        room,
      }, 'Emitting message.sent event');

      // Emit to all subscribers in conversation room
      socket.to(room).emit('message.sent', payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        error: errorMessage,
      }, 'Failed to emit message.sent');
      throw error;
    }
  }

  /**
   * Emit message.failed event to conversation subscribers
   * Called when message delivery fails (will retry)
   *
   * @param socket - Socket instance
   * @param payload - Message failed payload
   */
  @OnMessage('message.failed')
  async onMessageFailed(socket: Socket, payload: MessageFailedPayload): Promise<void> {
    const room = `conversation:${payload.conversationId}`;

    try {
      logger.debug({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        attempt: payload.attempt,
        room,
      }, 'Emitting message.failed event');

      // Emit to all subscribers in conversation room
      socket.to(room).emit('message.failed', payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        error: errorMessage,
      }, 'Failed to emit message.failed');
      throw error;
    }
  }

  /**
   * Handle message.retry request from client
   * Client requests retry of failed message
   *
   * @param socket - Socket instance
   * @param data - Retry request data
   */
  @OnMessage('message.retry')
  async onMessageRetry(
    socket: Socket,
    data: { messageId: string; conversationId: string }
  ): Promise<void> {
    try {
      logger.debug({
        messageId: data.messageId,
        conversationId: data.conversationId,
        socketId: socket.id,
      }, 'Client requested message retry');

      // Acknowledge retry request
      socket.emit('message.retry.acknowledged', {
        messageId: data.messageId,
        timestamp: new Date().toISOString(),
      });

      // Broadcast retry to conversation
      const room = `conversation:${data.conversationId}`;
      socket.to(room).emit('message.retry.started', {
        messageId: data.messageId,
        conversationId: data.conversationId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        messageId: data.messageId,
        conversationId: data.conversationId,
        error: errorMessage,
      }, 'Failed to handle message.retry');
      throw error;
    }
  }

  /**
   * Handle message received acknowledgement from client
   * Track that client received message event
   *
   * @param socket - Socket instance
   * @param data - Acknowledgement data
   */
  @OnMessage('message.received.ack')
  async onMessageReceivedAck(
    socket: Socket,
    data: { messageId: string; conversationId: string }
  ): Promise<void> {
    try {
      logger.debug({
        messageId: data.messageId,
        conversationId: data.conversationId,
        socketId: socket.id,
      }, 'Client acknowledged message received');

      // Track receipt in background (optional)
      // Could emit to analytics service or store in DB
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        messageId: data.messageId,
        error: errorMessage,
      }, 'Failed to handle message.received.ack');
      // Don't throw - this is optional tracking
    }
  }
}
