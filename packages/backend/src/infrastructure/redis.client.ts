/**
 * Redis Client
 *
 * Initializes and provides access to Redis connection
 * Follows ADR-005: Infrastructure folder for client initialization with DI
 */

import Redis from 'ioredis';
import { config } from '../config/config';

/**
 * Redis client class
 * Manages Redis connection for BullMQ message retry queue
 * Uses DI pattern: accepts config in constructor
 */
export class RedisClient {
  private client: Redis;
  private config: {
    host: string;
    port: number;
    password?: string;
    db: number;
    maxRetries: number;
    enableReadyCheck: boolean;
    lazyConnect: boolean;
  };

  /**
   * Initialize Redis connection with provided config
   */
  constructor(redisConfig = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: 0,
    maxRetries: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  }) {
    this.config = redisConfig;
    this.client = new Redis(redisConfig);

    // Setup event listeners
    this.client.on('connect', () => {
      console.log('Redis connected', {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db,
      });
    });

    this.client.on('ready', () => {
      console.log('Redis ready');
    });

    this.client.on('error', (err: Error) => {
      console.error('Redis error', { error: err.message });
    });

    this.client.on('close', () => {
      console.log('Redis connection closed');
    });

    this.client.on('reconnecting', (delay: number) => {
      console.warn('Redis reconnecting', { delay });
    });
  }

  /**
   * Get Redis client instance
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.client.quit();
    console.log('Redis connection closed');
  }

  /**
   * Check Redis connection health
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed', { error });
      return false;
    }
  }

  /**
   * Flush all data in current Redis DB (use with caution!)
   */
  async flush(): Promise<void> {
    try {
      await this.client.flushdb();
      console.warn('Redis DB flushed');
    } catch (error) {
      console.error('Failed to flush Redis DB', { error });
      throw error;
    }
  }
}
