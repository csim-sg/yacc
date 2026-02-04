/**
 * Message Retry Worker
 *
 * BullMQ worker that processes retry jobs for failed outbound messages.
 * Implements exponential backoff retry strategy.
 */

import { Worker, Job } from 'bullmq';
import type { RetryJobData } from '@yacc/common/types/RetryJobData.interface';
import { enqueueRetry, getRetryQueue } from '../config/queues';
import { logger } from '../infrastructure/logger';
import { redisClient } from '../infrastructure/redis.client';
import type { IConnector } from '@yacc/common/types/iConnector.interface';

// ============================================
// Worker Configuration
// ============================================

const WORKER_CONCURRENCY = 1; // Process 1 job at a time (can be increased)

// ============================================
// Connector Registry (to be populated during app init)
// ============================================

const connectorRegistry = new Map<string, IConnector>();

/**
 * Register a connector instance for retry worker
 */
export function registerConnector(platform: string, connector: IConnector): void {
   connectorRegistry.set(platform, connector);
   logger.info('Connector registered for retry worker - platform: %s', platform);
 }

/**
 * Get connector instance by platform
 */
function getConnector(platform: string): IConnector | undefined {
  return connectorRegistry.get(platform);
}

// ============================================
// Retry Worker (Singleton)
// ============================================

let retryWorker: Worker<RetryJobData> | null = null;

/**
 * Create or get retry worker singleton
 */
export function getRetryWorker(): Worker<RetryJobData> {
   if (retryWorker) {
     return retryWorker;
   }

   retryWorker = new Worker<RetryJobData>(
     'message-retry',
     // eslint-disable-next-line @typescript-eslint/no-explicit-any
     async (job: any) => processRetryJob(job),
     {
       connection: redisClient,
       concurrency: WORKER_CONCURRENCY,
     }
   );

   // Worker event handlers
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   retryWorker.on('completed', (job: any, result: any) => {
     logger.info('Retry job completed - jobId: %s, messageId: %s, platform: %s, result: %O', 
       job?.id, job?.data?.messageId, job?.data?.platform, result);
   });

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   retryWorker.on('failed', (job: any, error: any) => {
     logger.error('Retry job failed - jobId: %s, messageId: %s, platform: %s, attempt: %d, error: %s, stack: %s',
       job?.id, job?.data?.messageId, job?.data?.platform, job?.data?.attemptNumber, 
       error?.message, error?.stack);
   });

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   retryWorker.on('error', (error: any) => {
     logger.error('Retry worker error - message: %s, stack: %s', error?.message, error?.stack);
   });

  logger.info('Retry worker created');

  return retryWorker;
}

/**
 * Process a retry job
 */
async function processRetryJob(job: Job<RetryJobData>): Promise<void> {
   const { messageId, conversationId, platform, attemptNumber } = job.data;

   logger.info('Processing retry job - messageId: %s, conversationId: %s, platform: %s, attempt: %d',
     messageId, conversationId, platform, attemptNumber);

  try {
    // Get connector instance
    const connector = getConnector(platform);
    if (!connector) {
      throw new Error(`No connector found for platform: ${platform}`);
    }

    // Fetch message details from database
    // TODO: Implement database query once DB layer is ready
    // const message = await MessageRepository.findById(messageId);

    // Send message via connector
    // TODO: Implement after connectors are built
    // const response = await connector.sendMessage({
    //   channelId: message.channelId,
    //   body: message.body,
    //   attachments: message.attachments,
    //   replyToMessageId: message.replyToMessageId,
    // });

    // TODO: Update message status based on response
    // if (response.success) {
    //   await MessageRepository.updateStatus(messageId, 'sent');
    //   // Emit WebSocket events
    //   // socket.emit('message.sent', { ... });
    // } else if (response.error?.retryable && attemptNumber < JOB_ATTEMPTS) {
    //   // Enqueue next retry
    //   await enqueueRetry({
    //     messageId,
    //     conversationId,
    //     platform,
    //     attemptNumber: attemptNumber + 1,
    //     attemptAt: new Date(),
    //   });
    // } else {
    //   // Final failure - move to DLQ
    //   await MessageRepository.updateStatus(messageId, 'failed');
    //   // Emit failed event
    //   // socket.emit('message.failed', { messageId, error });
    // }

     // For now, just log success (full implementation after DB layer)
     logger.info('Message retry processed - messageId: %s, attempt: %d', messageId, attemptNumber);

   } catch (error) {
     logger.error('Failed to process retry job - messageId: %s, conversationId: %s, platform: %s, attempt: %d, error: %s, stack: %s',
       messageId, conversationId, platform, attemptNumber, 
       error instanceof Error ? error.message : String(error),
       error instanceof Error ? error.stack : 'unknown');

    // Rethrow to trigger BullMQ retry logic
    throw error;
  }
}

/**
 * Close retry worker
 */
export async function closeRetryWorker(): Promise<void> {
  if (retryWorker) {
    await retryWorker.close();
    retryWorker = null;
    logger.info('Retry worker closed');
  }
}


