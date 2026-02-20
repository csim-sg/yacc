/**
 * Redis Client (Singleton)
 *
 * Initializes and provides access to Redis connection
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import Redis from 'ioredis';
import { appConfig } from '../config/appConfig';
import { logger } from './logger';

// Singleton: Initialize connection once at module load
const redis = new Redis({
  host: appConfig.REDIS_HOST,
  port: appConfig.REDIS_PORT,
  password: appConfig.REDIS_PASSWORD || undefined,
  db: 0,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

// Setup event listeners
redis.on('connect', () => {
  logger.info('Redis connected to %s:%d', appConfig.REDIS_HOST, appConfig.REDIS_PORT);
});

redis.on('ready', () => {
  logger.info('Redis ready');
});

redis.on('error', (err: Error) => {
  logger.error('Redis error: %s', err.message);
});

redis.on('close', () => {
  logger.info('Redis connection closed');
});

redis.on('reconnecting', (delay: number) => {
  logger.warn('Redis reconnecting with %d ms delay', delay);
});

export const redisClient = redis;

/**
 * Get Redis client (for compatibility with queue service)
 */
export function getRedisClient(): Redis {
  return redis;
}

/**
 * Close Redis connection
 */
export async function closeRedisClient(): Promise<void> {
  await redis.quit();
  logger.info('Redis connection closed');
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Flush all data in current Redis DB (use with caution!)
 */
export async function flushRedis(): Promise<void> {
  try {
    await redis.flushdb();
    logger.warn('Redis DB flushed');
  } catch (error) {
    logger.error('Failed to flush Redis DB: %s', error instanceof Error ? error.message : String(error));
    throw error;
  }
}
