/**
 * Message Retry Worker
 *
 * BullMQ worker that processes retry jobs for failed outbound messages.
 * Implements exponential backoff retry strategy.
 *
 * DEV-006: Uses gateway-exchange for unified outbound dispatch.
 * @see ADR-005 Addendum-2 - Gateway-Exchange Pattern
 */

import type { Platform } from '@yacc/common/types/platform.type';
import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client.js';
import { logger } from '../infrastructure/logger';
import { redisClient } from '../infrastructure/redis.client.js';
import { conversations } from '../schemas/conversation.schema.js';
import { messages } from '../schemas/message.schema.js';
import { gatewayExchange } from '../services/gateway-exchange.js';
import { MessageStatusTracker } from '../services/messageStatusTracker.js';
import type { OutboundMessagePayload } from '../types/gateway.types.js';
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
 * Fetches message from DB, attempts to resend via gateway-exchange,
 * and updates status or moves to DLQ based on result
 *
 * DEV-006: Uses gateway-exchange for unified outbound dispatch.
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
  let traceCorrelationId: string | undefined;

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

    // Use correlationId from payload or fall back to stored value in message.metadata
    // This ensures correlationId is propagated end-to-end even for retries
    const messageMetadata = typeof message.metadata === 'object' && message.metadata !== null
      ? (message.metadata as Record<string, unknown>)
      : {};
    traceCorrelationId = correlationId || (messageMetadata.correlationId as string | undefined);

    // Build outbound payload for gateway-exchange
    const outboundPayload: OutboundMessagePayload = {
      conversationId,
      body,
      userId: message.senderId || 'system',
      correlationId: traceCorrelationId,
      metadata: {
        recipientId,
        retryCount,
      },
    };

    // Dispatch via gateway-exchange (handles adapter lookup, sending, status updates)
    const result = await gatewayExchange.handleOutbound(outboundPayload, messageId);

    if (result.success) {
      // Track sent status via MessageStatusTracker for WebSocket emission
      await MessageStatusTracker.trackSentMessage({
        messageId,
        conversationId,
        status: 'sent',
        platform,
        timestamp: result.timestamp,
      });

      logger.info(
        {
          messageId,
          conversationId,
          retryCount,
          platformType,
          externalMessageId: result.externalMessageId,
          correlationId: traceCorrelationId,
        },
        'Message retry succeeded via gateway-exchange'
      );
    } else {
      // Gateway returned failure - status already updated by gateway-exchange
      const errorMsg = result.error?.message || 'Gateway dispatch failed';
      throw new Error(errorMsg);
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
        correlationId: traceCorrelationId,
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


