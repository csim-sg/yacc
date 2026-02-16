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
import { connectorManager } from '../services/connector-manager.js';
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
 *
 * Export for testing purposes
 */
export async function processRetryJob(job: Job<SendMessageJobPayload>): Promise<void> {
  const {
    messageId,
    conversationId,
    recipientId,
    body,
    retryCount = 0,
    platformType,
    correlationId,
  } = job.data;

  logger.debug(
    {
      messageId,
      conversationId,
      retryCount,
      platformType,
      correlationId,
    },
    'Processing retry job'
  );

  let platform: Platform | undefined;

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
          correlationId,
        },
        'Message not found for retry'
      );
      // Don't retry if message is gone
      return;
    }

    // Fetch conversation for additional context
    const conversation = await dbClient.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });

    if (!conversation) {
      logger.warn(
        {
          conversationId,
          messageId,
          correlationId,
        },
        'Conversation not found for retry'
      );
      return;
    }

    platform = platformType as unknown as Platform;

    // Get connector for this platform
    const connector = connectorManager.getConnector(platformType);
    if (!connector) {
      throw new Error(`No connector registered for platform: ${platformType}`);
    }

    // Call connector to send message
    const sendRequest = {
      messageId,
      conversationId,
      recipientId,
      body,
      platformType: platformType as 'telegram' | 'irc' | 'whatsapp' | 'weChat' | 'meta' | 'twitter',
      correlationId,
    };

    const response = await connector.sendMessage(sendRequest);

    if (response.success) {
      // Update message with external ID and mark as sent
      await dbClient
        .update(messages)
        .set({
          externalMessageId: response.platformMessageId,
          status: 'sent',
          metadata: {
            sentAt: response.sentAt,
            platform: platformType,
          },
        })
        .where(eq(messages.id, messageId));

      // Track sent status via MessageStatusTracker for WebSocket emission
      await MessageStatusTracker.trackSentMessage({
        messageId,
        conversationId,
        status: 'sent',
        platform,
        timestamp: new Date(response.sentAt),
      });

      logger.info(
        {
          messageId,
          conversationId,
          retryCount,
          platformType,
          platformMessageId: response.platformMessageId,
          correlationId,
        },
        'Message retry succeeded'
      );
    } else {
      // Connector returned failure
      throw new Error(response.error || 'Connector returned failure');
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    logger.error(
      {
        messageId,
        conversationId,
        retryCount,
        platformType,
        error: errorMsg,
        correlationId,
      },
      'Retry job failed'
    );

    // Track as failed
    if (platform) {
      try {
        await MessageStatusTracker.trackFailedMessage({
          messageId,
          conversationId,
          status: 'failed',
          platform,
          error: errorMsg,
          timestamp: new Date(),
        });
      } catch (trackerError) {
        logger.error(
          {
            messageId,
            error: trackerError instanceof Error ? trackerError.message : 'Unknown',
            correlationId,
          },
          'Failed to track retry failure'
        );
      }
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


