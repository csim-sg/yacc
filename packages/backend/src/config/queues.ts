/**
 * Message Retry Queue
 *
 * BullMQ queue for handling failed outbound message retries
 * with exponential backoff strategy
 */

import { Queue, Job } from 'bullmq';
import type { RetryJobData } from '@yacc/common/types/RetryJobData.interface';
import { redisClient } from '../infrastructure/redis.client';
import { logger } from '../infrastructure/logger';

// ============================================
// Configuration
// ============================================

const RETRY_QUEUE_NAME = 'message-retry';
const DLQ_QUEUE_NAME = 'message-dlq';

// Retry schedule (strict 1m, 5m, 30m per attempt)
const RETRY_DELAYS_MS = [60000, 300000, 1800000]; // 1m, 5m, 30m
const MAX_ATTEMPTS = 3;

// Queue options
const QUEUE_OPTIONS = {
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: 10, // Remove completed jobs after 10
    removeOnFail: 100, // Remove failed jobs after 100
    attempts: MAX_ATTEMPTS,
    // No built-in backoff - we manage delays manually for strict 1m/5m/30m schedule
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

   queue.on('error', (error: Error) => {
     logger.error('Retry queue error: %s', error.message);
   });

   // Use type casting to handle BullMQ event signatures
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   (queue as any).on('waiting', (jobId: string) => {
     logger.debug('Job waiting: %s', jobId);
   });

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   (queue as any).on('active', (job: any) => {
     logger.debug('Job active: %s', job?.id);
   });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (queue as any).on('completed', (job: any) => {
    logger.info('Job completed: %s', job?.id);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (queue as any).on('failed', (job: any, error: Error) => {
    if (!job) return;

    // If max attempts reached, move to DLQ
    if (job.attemptsMade === job.opts?.attempts) {
      logger.warn(
        'Job failed, moving to DLQ - jobId: %s, attempts: %d, error: %s',
        job.id,
        job.attemptsMade,
        error.message
      );

      // Move to DLQ
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (getDLQ() as any).add(job.data, {
        ...job.opts,
        jobId: `dlq-${job.id}`,
        delay: 0,
      });
    } else {
      logger.warn(
        'Job failed, will retry - jobId: %s, attempt: %d, nextRetryIn: %dms, error: %s',
        job.id,
        job.attemptsMade,
        RETRY_DELAYS_MS[job.attemptsMade || 0],
        error.message
      );
    }
  });

  logger.info('Retry queue created: %s', RETRY_QUEUE_NAME);

  return queue;
}

/**
 * Create dead-letter queue
 */
function createDLQ(): Queue<RetryJobData> {
  const queue = new Queue<RetryJobData>(DLQ_QUEUE_NAME, QUEUE_OPTIONS);

  queue.on('error', (error: Error) => {
    logger.error('DLQ error: %s', error.message);
  });

  queue.on('waiting', (jobId: string) => {
    logger.debug('DLQ job waiting: %s', jobId);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (queue as any).on('active', (job: any) => {
    logger.debug('DLQ job active: %s', job?.id);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (queue as any).on('completed', (job: any) => {
    logger.info('DLQ job completed: %s', job?.id);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (queue as any).on('failed', (job: any, error: Error) => {
    logger.error('DLQ job failed permanently - jobId: %s, error: %s', job?.id, error.message);
  });

  logger.info('DLQ created: %s', DLQ_QUEUE_NAME);

  return queue;
}

/**
 * Enqueue message for retry
 *
 * @param data - Retry job data
 * @returns Job instance
 */
export async function enqueueRetry(
   data: RetryJobData
 ): Promise<Job<RetryJobData>> {
   const queue = getRetryQueue();

   // Use strict 1m/5m/30m delay schedule based on attempt number
   const retryDelay = RETRY_DELAYS_MS[Math.min(data.attemptNumber - 1, RETRY_DELAYS_MS.length - 1)] || 0;

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const job = await (queue as any).add(data, {
     jobId: `retry-${data.messageId}-attempt-${data.attemptNumber}`,
     delay: retryDelay,
     removeOnComplete: 10,
     removeOnFail: 100,
   });

  logger.info(
    'Message enqueued for retry - messageId: %s, conversationId: %s, platform: %s, attempt: %d, nextRetryIn: %dms',
    data.messageId,
    data.conversationId,
    data.platform,
    data.attemptNumber,
    retryDelay
  );

  return job;
}

/**
 * Remove message from retry queue (e.g., if manually retried)
 *
 * @param messageId - Message ID to remove
 */
export async function removeFromQueue(messageId: string): Promise<void> {
  const queue = getRetryQueue();
  const jobs = await queue.getJobs(['waiting', 'delayed']);

  let removedCount = 0;
  for (const job of jobs) {
    if (job.data?.messageId === messageId) {
      await job.remove();
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logger.info('Message removed from retry queue - messageId: %s, removedCount: %d', messageId, removedCount);
  } else {
    logger.debug('No retry jobs found for message - messageId: %s', messageId);
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


