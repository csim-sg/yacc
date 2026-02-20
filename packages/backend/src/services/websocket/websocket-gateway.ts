/**
 * WebSocket Gateway Service
 *
 * Provides the public API for emitting WebSocket events from services
 * Encapsulates Socket.io server instance and provides type-safe event emission
 *
 * Usage in other services:
 *   import { getWebSocketGateway } from './websocket-gateway';
 *   const ws = getWebSocketGateway();
 *   await ws.emitToConversation('conversation-id', 'message.sent', payload);
 */

import { logger } from '../../infrastructure/logger';
import type { WebSocketEventMap } from '../../types/websocket.types';
import type { WebSocketServer } from '../../websockets/websocket.server';
import { storeEvent } from './event-backlog.service';

/**
 * Global WebSocket gateway instance
 * Set when WebSocketServer is initialized
 */
let wsGateway: WebSocketServer | null = null;

/**
 * Set the WebSocket gateway instance
 * Called from index.ts during server startup
 *
 * @param gateway - WebSocket server instance
 */
export function setWebSocketGateway(gateway: WebSocketServer): void {
  wsGateway = gateway;
  logger.info('WebSocket gateway initialized');
}

/**
 * Get the WebSocket gateway instance
 *
 * @returns WebSocket server instance
 * @throws Error if gateway not initialized
 */
export function getWebSocketGateway(): WebSocketServer {
  if (!wsGateway) {
    throw new Error(
      'WebSocket gateway not initialized. Ensure WebSocketServer is created before accessing gateway.'
    );
  }
  return wsGateway;
}

/**
 * Check if WebSocket gateway is available
 *
 * @returns True if gateway is initialized
 */
export function isWebSocketGatewayAvailable(): boolean {
  return wsGateway !== null;
}

/**
 * Emit event to a conversation room
 * Safe for use from any service after gateway initialization
 *
 * Events are automatically stored in backlog for reconnection replay
 *
 * @param conversationId - Conversation ID
 * @param eventName - Event name (type-checked)
 * @param payload - Event payload (type-checked)
 * @throws Error if gateway not initialized
 */
export async function emitToConversation<K extends keyof WebSocketEventMap>(
  conversationId: string,
  eventName: K,
  payload: WebSocketEventMap[K]
): Promise<void> {
  try {
    const gateway = getWebSocketGateway();
    gateway.emitToConversation(conversationId, eventName, payload);

    // Store in backlog for reconnection replay (best-effort, don't wait)
    // Get subscribers for this conversation and store for each
    const subscribers = gateway.getConversationSubscribers(conversationId);
    for (const userId of subscribers) {
      storeEvent(eventName, payload, conversationId, userId).catch(() => {
        // Backlog storage is best-effort, ignore errors
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      'Failed to emit event to conversation - conversationId: %s, event: %s, error: %s',
      conversationId,
      eventName,
      errorMessage
    );
    throw error;
  }
}

/**
 * Emit event to a specific user
 * Safe for use from any service after gateway initialization
 *
 * @param userId - User ID
 * @param eventName - Event name (type-checked)
 * @param payload - Event payload (type-checked)
 * @throws Error if gateway not initialized
 */
export async function emitToUser<K extends keyof WebSocketEventMap>(
  userId: string,
  eventName: K,
  payload: WebSocketEventMap[K]
): Promise<void> {
  try {
    const gateway = getWebSocketGateway();
    gateway.emitToUser(userId, eventName, payload);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      'Failed to emit event to user - userId: %s, event: %s, error: %s',
      userId,
      eventName,
      errorMessage
    );
    throw error;
  }
}

/**
 * Broadcast event globally to all connected clients
 * Safe for use from any service after gateway initialization
 *
 * Events are automatically stored in backlog for reconnection replay
 * For global events (presence, etc.), stored without conversation ID
 *
 * @param eventName - Event name (type-checked)
 * @param payload - Event payload (type-checked)
 * @throws Error if gateway not initialized
 */
export async function emitGlobally<K extends keyof WebSocketEventMap>(
  eventName: K,
  payload: WebSocketEventMap[K]
): Promise<void> {
  try {
    const gateway = getWebSocketGateway();
    gateway.emitGlobally(eventName, payload);

    // Store in backlog for reconnection replay (best-effort)
    // Get all connected users and store for each
    const connectedUsers = gateway.getConnectedUserIds();
    for (const userId of connectedUsers) {
      storeEvent(eventName, payload, undefined, userId).catch(() => {
        // Backlog storage is best-effort, ignore errors
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to broadcast event globally - event: %s, error: %s', eventName, errorMessage);
    throw error;
  }
}

/**
 * Subscribe user to conversation room
 *
 * @param userId - User ID
 * @param conversationId - Conversation ID
 */
export function subscribeToConversation(userId: string, conversationId: string): void {
  try {
    const gateway = getWebSocketGateway();
    gateway.subscribeToConversation(userId, conversationId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      'Failed to subscribe user to conversation - userId: %s, conversationId: %s, error: %s',
      userId,
      conversationId,
      errorMessage
    );
  }
}

/**
 * Unsubscribe user from conversation room
 *
 * @param userId - User ID
 * @param conversationId - Conversation ID
 */
export function unsubscribeFromConversation(userId: string, conversationId: string): void {
  try {
    const gateway = getWebSocketGateway();
    gateway.unsubscribeFromConversation(userId, conversationId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      'Failed to unsubscribe user from conversation - userId: %s, conversationId: %s, error: %s',
      userId,
      conversationId,
      errorMessage
    );
  }
}

/**
 * Check if user is subscribed to conversation
 *
 * @param userId - User ID
 * @param conversationId - Conversation ID
 * @returns True if subscribed
 */
export function isSubscribedToConversation(userId: string, conversationId: string): boolean {
  try {
    const gateway = getWebSocketGateway();
    return gateway.isSubscribedToConversation(userId, conversationId);
  } catch (error) {
    logger.warn('Failed to check subscription status');
    return false;
  }
}

/**
 * Get all users subscribed to a conversation
 *
 * @param conversationId - Conversation ID
 * @returns Set of user IDs
 */
export function getConversationSubscribers(conversationId: string): Set<string> {
  try {
    const gateway = getWebSocketGateway();
    return gateway.getConversationSubscribers(conversationId);
  } catch (error) {
    logger.warn('Failed to get conversation subscribers');
    return new Set();
  }
}
