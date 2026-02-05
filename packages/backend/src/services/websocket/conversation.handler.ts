/**
 * Conversation Event Handler
 *
 * Handles conversation.updated events (status, priority, assignment changes)
 * Broadcasts updates to all connected users subscribed to the conversation
 */

import type { Server } from 'socket.io';
import { logger } from '../../infrastructure/logger';
import type { ConversationUpdatedPayload } from '../../types/websocket.types';
import { ConversationUpdatedPayloadSchema } from '../../types/websocket.types';

/**
 * Handle conversation.updated event
 *
 * @param io - Socket.io server instance
 * @param payload - Event payload
 */
export async function handleConversationUpdated(
  io: Server,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload with Zod schema
    const validated = ConversationUpdatedPayloadSchema.parse(payload);

    // Broadcast to conversation's room
    // All users subscribed to this conversation will receive the update
    const room = `conversation:${validated.conversationId}`;
    io.to(room).emit('conversation.updated', {
      conversationId: validated.conversationId,
      updatedFields: validated.updatedFields,
      changedBy: validated.changedBy,
      changedAt: validated.changedAt,
    } as ConversationUpdatedPayload);

    logger.debug(
      'Broadcasted conversation.updated event - conversationId: %s, room: %s, changedBy: %s',
      validated.conversationId,
      room,
      validated.changedBy
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to handle conversation.updated event: %s', errorMessage);
    throw error;
  }
}
