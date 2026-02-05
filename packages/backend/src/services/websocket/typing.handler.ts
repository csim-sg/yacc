/**
 * Typing Event Handlers
 *
 * Handles typing.started and typing.stopped events
 * Broadcasts typing indicators to conversation subscribers
 */

import type { Server } from 'socket.io';
import { logger } from '../../infrastructure/logger';
import type {
  TypingStartedPayload,
  TypingStoppedPayload,
} from '../../types/websocket.types';
import {
  TypingStartedPayloadSchema,
  TypingStoppedPayloadSchema,
} from '../../types/websocket.types';

/**
 * Handle typing.started event
 *
 * Emitted when: User starts typing in conversation
 *
 * @param io - Socket.io server instance
 * @param payload - Event payload
 */
export async function handleTypingStarted(
  io: Server,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload with Zod schema
    const validated = TypingStartedPayloadSchema.parse(payload);

    // Broadcast to conversation's room (all users in this conversation)
    const room = `conversation:${validated.conversationId}`;
    io.to(room).emit('typing.started', {
      conversationId: validated.conversationId,
      userId: validated.userId,
      name: validated.name,
    } as TypingStartedPayload);

    logger.debug(
      'Broadcasted typing.started event - conversationId: %s, userId: %s, name: %s',
      validated.conversationId,
      validated.userId,
      validated.name
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to handle typing.started event: %s', errorMessage);
    throw error;
  }
}

/**
 * Handle typing.stopped event
 *
 * Emitted when: User stops typing (timeout or explicit)
 *
 * @param io - Socket.io server instance
 * @param payload - Event payload
 */
export async function handleTypingStopped(
  io: Server,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload with Zod schema
    const validated = TypingStoppedPayloadSchema.parse(payload);

    // Broadcast to conversation's room
    const room = `conversation:${validated.conversationId}`;
    io.to(room).emit('typing.stopped', {
      conversationId: validated.conversationId,
      userId: validated.userId,
    } as TypingStoppedPayload);

    logger.debug(
      'Broadcasted typing.stopped event - conversationId: %s, userId: %s',
      validated.conversationId,
      validated.userId
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to handle typing.stopped event: %s', errorMessage);
    throw error;
  }
}
