/**
 * WebSocket Event Backlog Service
 *
 * Stores recently emitted events for replay on client reconnection
 * Maintains a 1-hour rolling window of events per user and conversation
 *
 * Usage:
 *   1. On event emission: await storeEvent(eventName, payload, conversationId, userId)
 *   2. On client reconnect: const events = await getBacklogForUser(userId)
 *   3. Cleanup old events: Automatic via TTL
 */

import { redisClient } from '../../infrastructure/redis.client';
import { logger } from '../../infrastructure/logger';
import { MESSAGE_BACKLOG_DURATION_MS } from '../../websockets/wsConstants';
import type { WebSocketEventMap } from '../../types/websocket.types';

/**
 * Event backlog entry with metadata
 */
interface BacklogEntry {
  eventName: keyof WebSocketEventMap;
  payload: any;
  conversationId?: string;
  emittedAt: string;
  expiresAt: string;
}

/**
 * Redis key prefix for backlog entries
 */
const BACKLOG_KEY_PREFIX = 'ws:backlog';

/**
 * Calculate expiration time (1 hour from now)
 */
function getExpirationTime(): number {
  return Math.floor(Date.now() / 1000) + MESSAGE_BACKLOG_DURATION_MS / 1000;
}

/**
 * Store an event in the backlog
 *
 * Events are stored per-user so they receive events from conversations they're subscribed to
 * and conversation-wide events they should see
 *
 * @param eventName - Event type (type-checked)
 * @param payload - Event payload
 * @param conversationId - Conversation ID (optional, for filtering)
 * @param userId - User ID to store event for
 */
export async function storeEvent<K extends keyof WebSocketEventMap>(
  eventName: K,
  payload: WebSocketEventMap[K],
  conversationId: string | undefined,
  userId: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + MESSAGE_BACKLOG_DURATION_MS).toISOString();

    const entry: BacklogEntry = {
      eventName,
      payload,
      conversationId,
      emittedAt: now,
      expiresAt,
    };

    // Store in Redis with user key and TTL
    // Key: ws:backlog:userId
    // Value: JSON array of events
    const key = `${BACKLOG_KEY_PREFIX}:${userId}`;
    const ttl = Math.floor(MESSAGE_BACKLOG_DURATION_MS / 1000);

    // Get existing backlog
    const existing = await redisClient.get(key);
    let backlog: BacklogEntry[] = existing ? JSON.parse(existing) : [];

    // Add new entry
    backlog.push(entry);

    // Keep only last 1000 events to prevent excessive memory usage
    if (backlog.length > 1000) {
      backlog = backlog.slice(-1000);
    }

    // Store value
    await redisClient.set(key, JSON.stringify(backlog));
    // Set expiration (in seconds)
    await (redisClient.expire as any)(key, Math.floor(ttl));

    logger.debug(
      'Stored event in backlog - userId: %s, event: %s, conversationId: %s, backlogSize: %d',
      userId,
      eventName,
      conversationId || 'global',
      backlog.length
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      'Failed to store event in backlog - userId: %s, event: %s, error: %s',
      userId,
      eventName,
      errorMessage
    );
    // Don't throw - backlog is best-effort
  }
}

/**
 * Get backlog of events for a user
 *
 * Returns all events from the last 1 hour that the user should receive
 * This is called on client reconnection to replay missed events
 *
 * @param userId - User ID
 * @returns Array of backlog events
 */
export async function getBacklogForUser(userId: string): Promise<BacklogEntry[]> {
  try {
    const key = `${BACKLOG_KEY_PREFIX}:${userId}`;
    const data = await redisClient.get(key);

    if (!data) {
      logger.debug('No backlog found for user - userId: %s', userId);
      return [];
    }

    const backlog: BacklogEntry[] = JSON.parse(data);

    // Filter out expired events
    const now = new Date();
    const validEvents = backlog.filter((event) => {
      const expiration = new Date(event.expiresAt);
      return expiration > now;
    });

    logger.debug(
      'Retrieved backlog for user - userId: %s, total: %d, valid: %d',
      userId,
      backlog.length,
      validEvents.length
    );

    return validEvents;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get backlog for user - userId: %s, error: %s', userId, errorMessage);
    return [];
  }
}

/**
 * Get backlog filtered by conversation
 *
 * Returns events relevant to a specific conversation
 * Includes both conversation-specific events and global events
 *
 * @param userId - User ID
 * @param conversationId - Conversation ID to filter by
 * @returns Array of backlog events for conversation
 */
export async function getBacklogForConversation(
  userId: string,
  conversationId: string
): Promise<BacklogEntry[]> {
  try {
    const allEvents = await getBacklogForUser(userId);

    // Filter events for this conversation
    const conversationEvents = allEvents.filter(
      (event) =>
        event.conversationId === conversationId || // Conversation-specific
        !event.conversationId || // Global events (presence, etc.)
        event.eventName === 'presence.updated' // Always include presence
    );

    logger.debug(
      'Retrieved backlog for conversation - userId: %s, conversationId: %s, count: %d',
      userId,
      conversationId,
      conversationEvents.length
    );

    return conversationEvents;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      'Failed to get backlog for conversation - userId: %s, conversationId: %s, error: %s',
      userId,
      conversationId,
      errorMessage
    );
    return [];
  }
}

/**
 * Clear backlog for a user
 *
 * Called after successfully replaying backlog to prevent duplicate delivery
 *
 * @param userId - User ID
 */
export async function clearBacklogForUser(userId: string): Promise<void> {
  try {
    const key = `${BACKLOG_KEY_PREFIX}:${userId}`;
    await redisClient.del(key);

    logger.debug('Cleared backlog for user - userId: %s', userId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Failed to clear backlog for user - userId: %s, error: %s', userId, errorMessage);
  }
}

/**
 * Get backlog statistics for monitoring
 *
 * Returns info about backlog usage across all users
 * Useful for monitoring Redis memory usage
 *
 * @returns Statistics object
 */
export async function getBacklogStats(): Promise<{
  totalBacklogs: number;
  estimatedEventsStored: number;
  estimatedMemoryMb: number;
}> {
  try {
    // Scan Redis for all backlog keys
    const pattern = `${BACKLOG_KEY_PREFIX}:*`;
    const keys = await redisClient.keys(pattern);

    let totalEvents = 0;
    let totalSize = 0;

    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const events = JSON.parse(data);
        totalEvents += events.length;
        totalSize += Buffer.byteLength(data, 'utf8');
      }
    }

    const stats = {
      totalBacklogs: keys.length,
      estimatedEventsStored: totalEvents,
      estimatedMemoryMb: totalSize / (1024 * 1024),
    };

    logger.debug({
      totalBacklogs: stats.totalBacklogs,
      estimatedEvents: stats.estimatedEventsStored,
      estimatedMemoryMb: stats.estimatedMemoryMb,
    }, 'Backlog stats');

    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to get backlog stats: %s', errorMessage);
    return {
      totalBacklogs: 0,
      estimatedEventsStored: 0,
      estimatedMemoryMb: 0,
    };
  }
}
