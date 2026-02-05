/**
 * WebSocket Event Handler Registry
 *
 * Central registry for all WebSocket event handlers
 * Maps event names to handler functions
 * Provides type-safe event emission
 */

import type { Server } from 'socket.io';
import { logger } from '../../infrastructure/logger';
import type { WebSocketEventMap } from '../../types/websocket.types';
import { handleConversationUpdated } from './conversation.handler';
import { handleMessageSent, handleMessageFailed } from './message.handler';
import { handleTypingStarted, handleTypingStopped } from './typing.handler';
import { handlePresenceUpdated } from './presence.handler';
import { handleReactionAdded, handleReactionRemoved } from './reaction.handler';

/**
 * Event handler mapping
 * Maps event names to handler functions
 */
const eventHandlers = {
  'conversation.updated': handleConversationUpdated,
  'message.sent': handleMessageSent,
  'message.failed': handleMessageFailed,
  'typing.started': handleTypingStarted,
  'typing.stopped': handleTypingStopped,
  'presence.updated': handlePresenceUpdated,
  'reaction.added': handleReactionAdded,
  'reaction.removed': handleReactionRemoved,
} as const;

/**
 * Type-safe event emission wrapper
 *
 * @param io - Socket.io server instance
 * @param eventName - Event name (type-checked)
 * @param payload - Event payload (type-checked)
 */
export async function emitEvent<K extends keyof WebSocketEventMap>(
  io: Server,
  eventName: K,
  payload: WebSocketEventMap[K]
): Promise<void> {
  try {
    const handler = eventHandlers[eventName];

    if (!handler) {
      throw new Error(`Unknown event type: ${eventName}`);
    }

    // Call handler with proper typing
    await (handler as any)(io, payload);

    logger.debug('Event emitted successfully - event: %s', eventName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to emit event %s: %s', eventName, errorMessage);
    throw error;
  }
}

/**
 * Get all registered event names
 *
 * @returns Array of event names
 */
export function getRegisteredEvents(): string[] {
  return Object.keys(eventHandlers);
}

/**
 * Check if event is registered
 *
 * @param eventName - Event name to check
 * @returns True if event is registered
 */
export function isEventRegistered(eventName: string): eventName is keyof typeof eventHandlers {
  return eventName in eventHandlers;
}

export type { WebSocketEventMap };
