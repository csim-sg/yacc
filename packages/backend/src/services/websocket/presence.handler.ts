/**
 * Presence Event Handler
 *
 * Handles presence.updated events (user online/offline status changes)
 * Broadcasts presence updates to all connected users
 */

import type { Server } from 'socket.io';
import { logger } from '../../infrastructure/logger';
import type { PresenceUpdatedPayload } from '../../types/websocket.types';
import { PresenceUpdatedPayloadSchema } from '../../types/websocket.types';

/**
 * Handle presence.updated event
 *
 * Emitted when: User comes online/offline
 *
 * @param io - Socket.io server instance
 * @param payload - Event payload
 */
export async function handlePresenceUpdated(
  io: Server,
  payload: unknown
): Promise<void> {
  try {
    // Validate payload with Zod schema
    const validated = PresenceUpdatedPayloadSchema.parse(payload);

    // Broadcast globally to all connected clients
    // Every user needs to know about presence changes
    io.emit('presence.updated', {
      userId: validated.userId,
      status: validated.status,
      lastSeen: validated.lastSeen,
    } as PresenceUpdatedPayload);

    logger.debug(
      'Broadcasted presence.updated event - userId: %s, status: %s',
      validated.userId,
      validated.status
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to handle presence.updated event: %s', errorMessage);
    throw error;
  }
}
