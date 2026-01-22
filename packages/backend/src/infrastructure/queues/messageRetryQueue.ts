/**
 * Message Retry Queue
 *
 * BullMQ queue for handling failed outbound message retries
 * with exponential backoff strategy
 */

import { Queue, Worker, Job } from 'bullmq';
import type { RetryJobData } from '@yacc/common/types/RetryJobData.interface';
import { getRedisClient } from '../infrastructure/redis';
import logger from '../utils/logger';

// ============================================
// Configuration
// ============================================

const RETRY_QUEUE_NAME = 'message-retry';
const DLQ_QUEUE_NAME = 'message-dlq';

// Retry schedule (exponential backoff)
const RETRY_DELAYS_MS = [60000, 300000, 1800000]; // 1m, 5m, 30m
const MAX_ATTEMPTS = 3;

// Queue options
const QUEUE_OPTIONS = {
  connection: getRedisClient(),
  defaultJobOptions: {
    removeOnComplete: 10, // Remove completed jobs after 10
    removeOnFail: 100, // Remove failed jobs after 100
    attempts: MAX_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: RETRY_DELAYS_MS[0],
    },
  },
  limiter: {
    max: 100, // Max 100 concurrent jobs
    duration: 1000, // Per second
  },
};

// ============================================
// Retry Queue (Singleton)
// ============================================

let retryQueue: Queue<RetryJobData> | null = null;
let dlqQueue: Queue<RetryJobData> | null = null;

/**
 * Get or create retry queue singleton
 */
export function getRetryQueue(): Queue<RetryJobData> {
  if (!retryQueue) {
    retryQueue = createRetryQueue();
  }
  return retryQueue;
}

/**
 * Get or create dead-letter queue singleton
 */
export function getDLQ(): Queue<RetryJobData> {
  if (!dlqQueue) {
    dlqQueue = createDLQ();
  }
  return dlqQueue;
}

/**
 * Create retry queue
 */
function createRetryQueue(): Queue<RetryJobData> {
  const queue = new Queue<RetryJobData>(RETRY_QUEUE_NAME, QUEUE_OPTIONS);

  queue.on('error', (error) => {
    logger.error('Retry queue error', { error: error.message });
  });

  queue.on('waiting', (jobId) => {
    logger.debug('Job waiting', { jobId });
  });

  queue.on('active', (job, jobPromise) => {
    logger.debug('Job active', { jobId: job.id });
  });

  queue.on('completed', (job, result) => {
    logger.info('Job completed', { jobId: job.id, result });
  });

  queue.on('failed', (job, error) => {
    // If max attempts reached, move to DLQ
    if (job.attemptsMade === job.opts?.attempts) {
      logger.warn('Job failed, moving to DLQ', {
        jobId: job.id,
        attempts: job.attemptsMade,
        error: error.message,
      });

      // Move to DLQ
      getDLQ().add(job.data, {
        ...job.opts,
        jobId: `dlq-${job.id}`,
        delay: 0,
      });
    } else {
      logger.warn('Job failed, will retry', {
        jobId: job.id,
        attempt: job.attemptsMade,
        nextRetryIn: RETRY_DELAYS_MS[job.attemptsMade || 0],
        error: error.message,
      });
    }
  });

  logger.info(`Retry queue '${RETRY_QUEUE_NAME}' created`);

  return queue;
}

/**
 * Create dead-letter queue
 */
function createDLQ(): Queue<RetryJobData> {
  const queue = new Queue<RetryJobData>(DLQ_QUEUE_NAME, QUEUE_OPTIONS);

  queue.on('error', (error) => {
    logger.error('DLQ error', { error: error.message });
  });

  queue.on('waiting', (jobId) => {
    logger.debug('DLQ job waiting', { jobId });
  });

  queue.on('active', (job) => {
    logger.debug('DLQ job active', { jobId: job.id });
  });

  queue.on('completed', (job, result) => {
    logger.info('DLQ job completed', { jobId: job.id });
  });

  queue.on('failed', (job, error) => {
    logger.error('DLQ job failed permanently', {
      jobId: job.id,
      error: error.message,
    });
  });

  logger.info(`DLQ '${DLQ_QUEUE_NAME}' created`);

  return queue;
}

/**
 * Enqueue message for retry
 *
 * @param data - Retry job data
 * @param delay - Initial delay in milliseconds (default: 0)
 * @returns Job instance
 */
export async function enqueueRetry(
  data: RetryJobData,
  delay: number = 0
): Promise<Job<RetryJobData>> {
  const queue = getRetryQueue();

  const job = await queue.add(data, {
    jobId: `retry-${data.messageId}-attempt-${data.attemptNumber}`,
    delay,
    removeOnComplete: 10,
    removeOnFail: 100,
  });

  logger.info('Message enqueued for retry', {
    messageId: data.messageId,
    conversationId: data.conversationId,
    platform: data.platform,
    attempt: data.attemptNumber,
    nextRetryIn: delay,
  });

  return job;
}

/**
 * Remove message from retry queue (e.g., if manually retried)
 *
 * @param messageId - Message ID to remove
 */
export async function removeFromQueue(messageId: string): Promise<void> {
  const queue = getRetryQueue();
  const jobs = await queue.getJobs(['waiting', 'delayed'], {
    message: messageId,
  });

  for (const job of jobs) {
    await job.remove();
    logger.info('Message removed from retry queue', { messageId });
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  dlq: number;
}> {
  const retryQueueInstance = getRetryQueue();
  const dlqQueueInstance = getDLQ();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    retryQueueInstance.getWaitingCount(),
    retryQueueInstance.getActiveCount(),
    retryQueueInstance.getCompletedCount(),
    retryQueueInstance.getFailedCount(),
    retryQueueInstance.getDelayedCount(),
  ]);

  const dlq = await dlqQueueInstance.getWaitingCount();

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    dlq,
  };
}

/**
 * Close all queues
 */
export async function closeQueues(): Promise<void> {
  if (retryQueue) {
    await retryQueue.close();
    retryQueue = null;
    logger.info('Retry queue closed');
  }

  if (dlqQueue) {
    await dlqQueue.close();
    dlqQueue = null;
    logger.info('DLQ closed');
  }
}

// ============================================
// Export
// ============================================

export {
  getRetryQueue,
  getDLQ,
  enqueueRetry,
  removeFromQueue,
  getQueueStats,
  closeQueues,
};
