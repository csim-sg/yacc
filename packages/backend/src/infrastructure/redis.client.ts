/**
 * Redis Client (Singleton)
 *
 * Initializes and provides access to Redis connection
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import Redis from 'ioredis';
import { config } from '../config/config';

// Singleton: Initialize connection once at module load
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: 0,
  maxRetries: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

// Setup event listeners
redis.on('connect', () => {
  console.log('Redis connected', {
    host: config.redis.host,
    port: config.redis.port,
    db: 0,
  });
});

redis.on('ready', () => {
  console.log('Redis ready');
});

redis.on('error', (err: Error) => {
  console.error('Redis error', { error: err.message });
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

redis.on('reconnecting', (delay: number) => {
  console.warn('Redis reconnecting', { delay });
});

export const redisClient = redis;

/**
 * Close Redis connection
 */
export async function closeRedisClient(): Promise<void> {
  await redis.quit();
  console.log('Redis connection closed');
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed', { error });
    return false;
  }
}

/**
 * Flush all data in current Redis DB (use with caution!)
 */
export async function flushRedis(): Promise<void> {
  try {
    await redis.flushdb();
    console.warn('Redis DB flushed');
  } catch (error) {
    console.error('Failed to flush Redis DB', { error });
    throw error;
  }
}
