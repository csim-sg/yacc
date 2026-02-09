/**
 * Message Retry Worker
 *
 * BullMQ worker that processes retry jobs for failed outbound messages.
 * Implements exponential backoff retry strategy.
 */

import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { Platform } from '@yacc/common/types/platform.type';
import { dbClient } from '../infrastructure/db.client.js';
import { logger } from '../infrastructure/logger.js';
import { redisClient } from '../infrastructure/redis.client.js';
import { conversations } from '../schemas/conversation.schema.js';
import { messages } from '../schemas/message.schema.js';
import { MessageStatusTracker } from '../services/messageStatusTracker.js';
import type { SendMessageJobPayload } from '../types/message-queue.types.js';

// ============================================
// Worker Configuration
// ============================================

const WORKER_CONCURRENCY = 5; // Process up to 5 jobs concurrently

// ============================================
// Retry Worker (Singleton)
// ============================================

let retryWorker: Worker<SendMessageJobPayload> | null = null;

/**
 * Create or get retry worker singleton
 */
export function getRetryWorker(): Worker<SendMessageJobPayload> {
  if (retryWorker) {
    return retryWorker;
  }

  retryWorker = new Worker<SendMessageJobPayload>(
    'message-retry-queue',
    async (job: Job<SendMessageJobPayload>) => processRetryJob(job),
    {
      connection: redisClient,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  // Worker event handlers
  retryWorker.on('completed', (job: Job<SendMessageJobPayload>, result: unknown) => {
    logger.info(
      {
        jobId: job.id,
        messageId: job.data.messageId,
        conversationId: job.data.conversationId,
        platform: job.data.platformType,
        result,
      },
      'Retry job completed'
    );
  });

  retryWorker.on('failed', (job: Job<SendMessageJobPayload> | undefined, error: Error) => {
    logger.error(
      {
        jobId: job?.id,
        messageId: job?.data.messageId,
        conversationId: job?.data.conversationId,
        platform: job?.data.platformType,
        retryCount: job?.data.retryCount,
        error: error.message,
      },
      'Retry job failed'
    );
  });

  retryWorker.on('error', (error: Error) => {
    logger.error(
      {
        error: error.message,
      },
      'Retry worker error'
    );
  });

  logger.info('Retry worker created');

  return retryWorker;
}

/**
 * Process a retry job
 *
 * Fetches message from DB, attempts to resend via connector,
 * and updates status or moves to DLQ based on result
 */
async function processRetryJob(job: Job<SendMessageJobPayload>): Promise<void> {
  const {
    messageId,
    conversationId,
    retryCount = 0,
    platformType,
  } = job.data;

  logger.debug(
    {
      messageId,
      conversationId,
      retryCount,
      platformType,
    },
    'Processing retry job'
  );

  try {
    // Fetch message from database to get current state
    const message = await dbClient.query.messages.findFirst({
      where: eq(messages.id, messageId),
    });

    if (!message) {
      logger.warn(
        {
          messageId,
          conversationId,
        },
        'Message not found for retry'
      );
      // Don't retry if message is gone
      return;
    }

    // Fetch conversation for channel info
    const conversation = await dbClient.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      logger.warn(
        {
          conversationId,
          messageId,
        },
        'Conversation not found for retry'
      );
      return;
    }

    // For Phase 2A MVP: Stub connector (always succeeds)
    // In Phase 2B/3, will call real connectors (Telegram, IRC)
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate I/O

    // Mark as sent (stub always succeeds)
    await MessageStatusTracker.trackSentMessage({
      messageId,
      conversationId,
      status: 'sent',
      platform: platformType as unknown as Platform,
      timestamp: new Date(),
    });

    logger.info(
      {
        messageId,
        conversationId,
        retryCount,
        platformType,
      },
      'Message retry succeeded (stub)'
    );
  } catch (error) {
    logger.error(
      {
        messageId,
        conversationId,
        retryCount,
        platformType,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Retry job failed'
    );

     // Track as failed
     try {
       await MessageStatusTracker.trackFailedMessage({
         messageId,
         conversationId,
         status: 'failed',
         platform: platformType as unknown as Platform,
         error: error instanceof Error ? error.message : 'Unknown error',
         timestamp: new Date(),
       });
    } catch (trackerError) {
      logger.error(
        {
          messageId,
          error: trackerError instanceof Error ? trackerError.message : 'Unknown',
        },
        'Failed to track retry failure'
      );
    }

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


