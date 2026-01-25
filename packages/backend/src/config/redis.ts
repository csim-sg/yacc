/**
 * Redis Configuration
 *
 * Manages Redis connection for BullMQ message retry queue
 */

import Redis from 'ioredis';
import logger from '../utils/logger';

// ============================================
// Configuration
// ============================================

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = parseInt(process.env.REDIS_DB || '0', 10);
const REDIS_MAX_RETRIES = parseInt(process.env.REDIS_MAX_RETRIES || '3', 10);
const REDIS_CONNECT_TIMEOUT = parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10);

// ============================================
// Redis Client (Singleton)
// ============================================

let redisClient: Redis | null = null;

/**
 * Get or create Redis client singleton
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

/**
 * Create new Redis client with configuration
 */
function createRedisClient(): Redis {
  const redisOptions: any = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: REDIS_DB,
    maxRetriesPerRequest: REDIS_MAX_RETRIES,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  if (REDIS_PASSWORD) {
    redisOptions.password = REDIS_PASSWORD;
  }

  const client = new Redis(redisOptions);

  // Setup event listeners
  client.on('connect', () => {
    logger.info('Redis connected', {
      host: REDIS_HOST,
      port: REDIS_PORT,
      db: REDIS_DB,
    });
  });

  client.on('ready', () => {
    logger.info('Redis ready');
  });

  client.on('error', (err: Error) => {
    logger.error('Redis error', { error: err.message });
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  client.on('reconnecting', (delay: number) => {
    logger.warn('Redis reconnecting', { delay });
  });

  return client;
}

/**
 * Close Redis connection
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed', { error });
    return false;
  }
}

/**
 * Flush all data in current Redis DB (use with caution!)
 */
export async function flushRedis(): Promise<void> {
  try {
    const client = getRedisClient();
    await client.flushdb();
    logger.warn('Redis DB flushed');
  } catch (error) {
    logger.error('Failed to flush Redis DB', { error });
    throw error;
  }
}

// ============================================
// Export
// ============================================

export { getRedisClient, closeRedisClient, checkRedisHealth, flushRedis };
