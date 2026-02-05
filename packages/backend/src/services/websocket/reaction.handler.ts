/**
 * Reaction Event Handlers
 *
 * Handles reaction.added and reaction.removed events
 * Broadcasts emoji reactions to conversation subscribers
 */

import type { Server } from 'socket.io';
import { logger } from '../../infrastructure/logger';
import type {
  ReactionAddedPayload,
  ReactionRemovedPayload,
} from '../../types/websocket.types';
import {
  ReactionAddedPayloadSchema,
  ReactionRemovedPayloadSchema,
} from '../../types/websocket.types';

/**
 * Handle reaction.added event
 *
 * Emitted when: User adds emoji reaction to message
 *
 * @param io - Socket.io server instance
 * @param payload - Event payload
 */
export async function handleReactionAdded(
  io: Server,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload with Zod schema
    const validated = ReactionAddedPayloadSchema.parse(payload);

    // Broadcast to conversation's room
    const room = `conversation:${validated.conversationId}`;
    io.to(room).emit('reaction.added', {
      messageId: validated.messageId,
      conversationId: validated.conversationId,
      emoji: validated.emoji,
      userId: validated.userId,
      name: validated.name,
    } as ReactionAddedPayload);

    logger.debug(
      'Broadcasted reaction.added event - messageId: %s, conversationId: %s, emoji: %s, userId: %s',
      validated.messageId,
      validated.conversationId,
      validated.emoji,
      validated.userId
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to handle reaction.added event: %s', errorMessage);
    throw error;
  }
}

/**
 * Handle reaction.removed event
 *
 * Emitted when: User removes emoji reaction from message
 *
 * @param io - Socket.io server instance
 * @param payload - Event payload
 */
export async function handleReactionRemoved(
  io: Server,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload with Zod schema
    const validated = ReactionRemovedPayloadSchema.parse(payload);

    // Broadcast to conversation's room
    const room = `conversation:${validated.conversationId}`;
    io.to(room).emit('reaction.removed', {
      messageId: validated.messageId,
      conversationId: validated.conversationId,
      emoji: validated.emoji,
      userId: validated.userId,
    } as ReactionRemovedPayload);

    logger.debug(
      'Broadcasted reaction.removed event - messageId: %s, conversationId: %s, emoji: %s, userId: %s',
      validated.messageId,
      validated.conversationId,
      validated.emoji,
      validated.userId
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to handle reaction.removed event: %s', errorMessage);
    throw error;
  }
}
