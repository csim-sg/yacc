import type { SendMessageRequest } from '@yacc/common/types/sendMessageRequest.interface';
import type { SendMessageResponse } from '@yacc/common/types/sendMessageResponse.interface';
import type { Job } from 'bullmq';

import { logger } from '../infrastructure/logger';
import type { BaseConnector } from '../connectors/base/baseConnector';
import type { SendMessageJobPayload } from '../types/message-queue.types';
import { queueDatabaseIntegration } from './queueDatabaseIntegration';

/**
 * Message Queue Processor
 *
 * Handles processing of individual message jobs from the retry queue.
 * Implements platform-specific delivery logic (Telegram, IRC).
 *
 * For each job:
 * 1. Validate payload
 * 2. Get appropriate connector based on platform
 * 3. Send message to platform
 * 4. Update database message status
 * 5. Emit completion or failure event
 */

// TODO: These will be injected from the connector factory
// For now, using a placeholder map
const connectorRegistry: Map<string, BaseConnector> = new Map();

/**
 * Register a connector for a platform
 *
 * @param platform - Platform name (telegram, irc)
 * @param connector - Connector instance
 */
export function registerConnector(platform: string, connector: BaseConnector): void {
  connectorRegistry.set(platform, connector);
  logger.info({ platform }, 'Connector registered');
}

/**
 * Get connector for platform
 *
 * @param platform - Platform name
 * @returns Connector instance
 * @throws Error if connector not found
 */
function getConnector(platform: string): BaseConnector {
  const connector = connectorRegistry.get(platform);
  if (!connector) {
    throw new Error(`No connector registered for platform: ${platform}`);
  }
  return connector;
}

/**
 * Process a message delivery job
 *
 * This is the main processor function passed to BullMQ worker.
 * Called for each job in the queue.
 *
 * @param job - BullMQ job containing message payload
 * @throws Error if delivery fails (triggers retry)
 */
export async function messageQueueProcessor(job: Job<SendMessageJobPayload>): Promise<void> {
  const { messageId, conversationId, platformType, body, recipientId } = job.data;
  const jobId = job.id || '';

  try {
    logger.debug(
      {
        jobId,
        messageId,
        conversationId,
        platform: platformType,
        attempt: job.attemptsMade || 0,
      },
      'Processing message delivery job'
    );

    // Get appropriate connector
    const connector = getConnector(platformType);

    // Build send request
    const sendRequest: SendMessageRequest = {
      messageId,
      conversationId,
      recipientId,
      body,
      metadata: job.data.metadata,
    };

    // Send message via platform
    const response: SendMessageResponse = await connector.sendMessage(sendRequest);

    if (!response.success) {
      throw new Error(response.error);
    }

    // Log success
    logger.info(
      {
        jobId,
        messageId,
        conversationId,
        platform: platformType,
        platformMessageId: response.platformMessageId,
        sentAt: response.sentAt,
      },
      'Message delivered successfully'
    );

    // Update database message status to 'sent'
    await queueDatabaseIntegration.updateMessageSent(job.data, response.platformMessageId);

    // Mark job as complete (BullMQ will handle removal based on defaultJobOptions)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const attemptsMade = job.attemptsMade || 0;
    const maxAttempts = job.opts.attempts || 3;
    const nextRetryTime = new Date(Date.now() + 60000).toISOString(); // Default 1m

    logger.warn(
      {
        jobId,
        messageId,
        conversationId,
        platform: platformType,
        attempt: attemptsMade + 1,
        maxAttempts,
        error: errorMessage,
      },
      'Message delivery failed - will retry'
    );

    // Update database message status with error details
    await queueDatabaseIntegration.updateMessageFailed(
      job.data,
      error instanceof Error ? error : new Error(errorMessage),
      attemptsMade,
      maxAttempts,
      nextRetryTime
    );

    // Rethrow to trigger BullMQ retry mechanism
    throw error;
  }
}

/**
 * Categorize error for better DLQ handling
 *
 * Helps determine if an error is retryable or permanent.
 * Used by DLQ handler to determine appropriate action.
 *
 * @param error - Error instance
 * @returns Error category
 * 
 * @example
 * // Network errors (retryable)
 * categorizeError(new Error('ECONNREFUSED')) => 'network_error'
 * 
 * // Platform auth errors (not retryable)
 * categorizeError(new Error('Unauthorized')) => 'platform_error'
 * 
 * @internal Future use: Called by DLQ handler in Phase 4
 */
export function categorizeError(error: Error): string {
  const message = error.message.toLowerCase();

  // Network errors (retryable)
  if (
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('network')
  ) {
    return 'network_error';
  }

  // Platform auth errors (typically not retryable)
  if (message.includes('unauthorized') || message.includes('forbidden')) {
    return 'platform_error';
  }

  // Validation errors (not retryable)
  if (message.includes('invalid') || message.includes('validation')) {
    return 'validation_error';
  }

  // Unknown
  return 'unknown';
}

/**
 * Initialize processor with connectors
 *
 * Called during application startup to register all connectors
 * and prepare the processor for handling jobs.
 *
 * @param connectors - Map of platform to connector instances
 */
export function initializeProcessor(connectors: Map<string, BaseConnector>): void {
  try {
    connectors.forEach((connector, platform) => {
      registerConnector(platform, connector);
    });

    logger.info(
      { connectorCount: connectors.size, platforms: Array.from(connectors.keys()) },
      'Message queue processor initialized'
    );
  } catch (error) {
    logger.error({ error }, 'Failed to initialize message queue processor');
    throw error;
  }
}

/**
 * Get processor function for BullMQ worker
 *
 * Returns the main processor function to be passed to Worker.
 *
 * @returns Processor function
 */
export function getProcessorFunction(): (job: Job<SendMessageJobPayload>) => Promise<void> {
  return messageQueueProcessor;
}
