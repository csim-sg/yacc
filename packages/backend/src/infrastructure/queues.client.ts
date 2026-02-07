/**
 * Queues Client (Singleton)
 *
 * Initializes and provides access to BullMQ message retry queue
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import { Queue } from 'bullmq';
import { getRedisClient } from './redis.client';
import { logger } from './logger';
import type { SendMessageJobPayload } from '../types/message-queue.types';
import { QUEUE_NAMES, RETRY_CONFIG } from '../types/message-queue.types';

// Singleton: Initialize queue connection once at module load
const redisConnection = getRedisClient();

/**
 * Message retry queue for outbound message delivery
 * Implements exponential backoff: 1m → 5m → 30m (3 attempts max)
 */
export const messageRetryQueue = new Queue<SendMessageJobPayload>(
  QUEUE_NAMES.MESSAGE_QUEUE,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: RETRY_CONFIG.MAX_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: RETRY_CONFIG.BACKOFF_DELAYS[0],
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  }
);

/**
 * Get the message retry queue
 */
export function getRetryQueue(): Queue<SendMessageJobPayload> {
  return messageRetryQueue;
}

/**
 * Enqueue a message for retry
 *
 * @param payload - Message job payload
 * @returns Job ID
 */
export async function enqueueRetry(payload: SendMessageJobPayload): Promise<string> {
  try {
    const job = await messageRetryQueue.add('send-message', payload, {
      jobId: payload.messageId,
      attempts: RETRY_CONFIG.MAX_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: RETRY_CONFIG.BACKOFF_DELAYS[0],
      },
    });

    logger.info(
      {
        jobId: job.id,
        messageId: payload.messageId,
        conversationId: payload.conversationId,
      },
      'Message enqueued for retry'
    );

    return job.id || '';
  } catch (error) {
    logger.error(
      {
        messageId: payload.messageId,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to enqueue message for retry'
    );
    throw error;
  }
}

/**
 * Close message retry queue
 */
export async function closeRetryQueue(): Promise<void> {
  try {
    await messageRetryQueue.close();
    logger.info('Message retry queue closed');
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to close message retry queue'
    );
    throw error;
  }
}
