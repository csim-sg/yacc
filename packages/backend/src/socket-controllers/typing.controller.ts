/**
 * Typing Socket Controller
 *
 * Handles real-time typing indicators
 * Uses socket-controllers for declarative event handling
 */

import { SocketController, OnMessage } from 'socket-controllers';
import type { Socket } from 'socket.io';
import { logger } from '../infrastructure/logger';
import type { TypingStartedPayload, TypingStoppedPayload } from '../types/websocket.types';

@SocketController()
export class TypingController {
  /**
   * Emit typing.started event when user starts typing
   * Broadcast to other users in conversation
   *
   * @param socket - Socket instance
   * @param payload - Typing started payload
   */
  @OnMessage('typing.started')
  async onTypingStarted(socket: Socket, payload: TypingStartedPayload): Promise<void> {
    const room = `conversation:${payload.conversationId}`;

    try {
      logger.debug({
        userId: payload.userId,
        conversationId: payload.conversationId,
        room,
      }, 'User started typing');

      // Broadcast to other users in conversation
      socket.to(room).emit('typing.started', payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        userId: payload.userId,
        conversationId: payload.conversationId,
        error: errorMessage,
      }, 'Failed to emit typing.started');
      throw error;
    }
  }

  /**
   * Emit typing.stopped event when user stops typing
   * Can be triggered by explicit action or timeout
   *
   * @param socket - Socket instance
   * @param payload - Typing stopped payload
   */
  @OnMessage('typing.stopped')
  async onTypingStopped(socket: Socket, payload: TypingStoppedPayload): Promise<void> {
    const room = `conversation:${payload.conversationId}`;

    try {
      logger.debug({
        userId: payload.userId,
        conversationId: payload.conversationId,
        room,
      }, 'User stopped typing');

      // Broadcast to other users in conversation
      socket.to(room).emit('typing.stopped', payload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        userId: payload.userId,
        conversationId: payload.conversationId,
        error: errorMessage,
      }, 'Failed to emit typing.stopped');
      throw error;
    }
  }

  /**
   * Handle typing indicator timeout
   * Server-side timeout if client doesn't send typing.stopped
   * Useful for network disconnections or client crashes
   *
   * @param socket - Socket instance
   * @param data - Timeout data
   */
  @OnMessage('typing.timeout')
  async onTypingTimeout(
    socket: Socket,
    data: { userId: string; conversationId: string }
  ): Promise<void> {
    const room = `conversation:${data.conversationId}`;

    try {
      logger.debug({
        userId: data.userId,
        conversationId: data.conversationId,
      }, 'Typing indicator timed out');

      // Broadcast timeout to clear typing indicator on other clients
      socket.to(room).emit('typing.stopped', {
        conversationId: data.conversationId,
        userId: data.userId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        userId: data.userId,
        conversationId: data.conversationId,
        error: errorMessage,
      }, 'Failed to handle typing.timeout');
      // Don't throw - timeout handling is best-effort
    }
  }

  /**
   * Client heartbeat for typing indicator
   * Prevents timeout while user is actively typing
   *
   * @param socket - Socket instance
   * @param data - Heartbeat data
   */
  @OnMessage('typing.heartbeat')
  async onTypingHeartbeat(
    socket: Socket,
    data: { userId: string; conversationId: string }
  ): Promise<void> {
    try {
      logger.debug({
        userId: data.userId,
        conversationId: data.conversationId,
      }, 'Received typing heartbeat');

      // Reset timeout timer on server (if implemented)
      // This is optional - client can just resend typing.started periodically
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({
        userId: data.userId,
        error: errorMessage,
      }, 'Failed to handle typing.heartbeat');
      // Don't throw - heartbeat is optional
    }
  }
}
