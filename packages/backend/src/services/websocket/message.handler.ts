/**
 * Message Event Handlers
 *
 * Handles message.sent and message.failed events
 * Broadcasts message status updates to conversation subscribers
 */

import type { Server } from 'socket.io';
import { logger } from '../../infrastructure/logger';
import type {
  MessageSentPayload,
  MessageFailedPayload,
} from '../../types/websocket.types';
import {
  MessageSentPayloadSchema,
  MessageFailedPayloadSchema,
} from '../../types/websocket.types';

/**
 * Handle message.sent event
 *
 * Emitted when: Message successfully delivered to platform
 *
 * @param io - Socket.io server instance
 * @param payload - Event payload
 */
export async function handleMessageSent(
  io: Server,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload with Zod schema
    const validated = MessageSentPayloadSchema.parse(payload);

    // Broadcast to conversation's room
    const room = `conversation:${validated.conversationId}`;
    io.to(room).emit('message.sent', {
      messageId: validated.messageId,
      conversationId: validated.conversationId,
      status: 'sent',
      sentAt: validated.sentAt,
    } as MessageSentPayload);

    logger.debug(
      'Broadcasted message.sent event - messageId: %s, conversationId: %s',
      validated.messageId,
      validated.conversationId
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to handle message.sent event: %s', errorMessage);
    throw error;
  }
}

/**
 * Handle message.failed event
 *
 * Emitted when: Message delivery fails (will retry)
 *
 * @param io - Socket.io server instance
 * @param payload - Event payload
 */
export async function handleMessageFailed(
  io: Server,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload with Zod schema
    const validated = MessageFailedPayloadSchema.parse(payload);

    // Broadcast to conversation's room
    const room = `conversation:${validated.conversationId}`;
    io.to(room).emit('message.failed', {
      messageId: validated.messageId,
      conversationId: validated.conversationId,
      status: 'failed',
      error: validated.error,
      retryAt: validated.retryAt,
      attempt: validated.attempt,
    } as MessageFailedPayload);

    logger.debug(
      'Broadcasted message.failed event - messageId: %s, conversationId: %s, attempt: %d',
      validated.messageId,
      validated.conversationId,
      validated.attempt
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to handle message.failed event: %s', errorMessage);
    throw error;
  }
}
