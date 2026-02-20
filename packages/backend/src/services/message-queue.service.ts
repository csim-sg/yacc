import { Queue, Worker, Job } from 'bullmq';
import { getRedisClient } from '../infrastructure/redis.client';
import { logger } from '../infrastructure/logger';
import { queueDatabaseIntegration } from './queue-database-integration';
import {
  SendMessageJobPayload,
  SendMessageJobPayloadSchema,
  RETRY_CONFIG,
  QUEUE_NAMES,
  QueueStatistics,
  DLQEntry,
  DLQEntrySchema,
  JobCompletionResult,
  JobRetryMetadata,
  FailureReason,
} from '../types/message-queue.types';

/**
 * Message Queue Service
 *
 * Manages outbound message retry queue with exponential backoff.
 * Exponential backoff strategy: 1m → 5m → 30m (3 attempts max)
 *
 * Usage:
 *   const result = await messageQueueService.enqueueMessage(payload);
 *   await messageQueueService.initialize(processor);
 */

class MessageQueueService {
  private messageQueue: Queue<SendMessageJobPayload>;
  private dlqQueue: Queue<DLQEntry>;
  private worker: Worker<SendMessageJobPayload> | null = null;
  private isInitialized = false;

  constructor() {
    const redisConnection = getRedisClient();
    
    this.messageQueue = new Queue<SendMessageJobPayload>(
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

    this.dlqQueue = new Queue<DLQEntry>(QUEUE_NAMES.DLQ, {
      connection: redisConnection,
      defaultJobOptions: {
        removeOnComplete: {
          age: 604800, // Keep DLQ entries for 7 days
        },
      },
    });

    this.setupEventListeners();
  }

  /**
   * Initialize the queue service and register processor
   */
  async initialize(processor: (job: Job<SendMessageJobPayload>) => Promise<void>): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Message queue service already initialized');
      return;
    }

    try {
      await this.registerProcessor(processor);
      this.isInitialized = true;
      logger.info('Message queue service initialized');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize message queue service');
      throw error;
    }
  }

  /**
   * Enqueue a message for sending
   */
  async enqueueMessage(payload: SendMessageJobPayload): Promise<Job<SendMessageJobPayload>> {
    try {
      // Validate payload
      const validated = SendMessageJobPayloadSchema.parse(payload);

      // Create job with idempotent job ID
      // BullMQ v5+ uses positional args: queue.add(jobName, data, options)
      const job = await this.messageQueue.add(
        'send-message',
        validated,
        {
          jobId: `msg-${validated.messageId}`,
        }
      ) as Job<SendMessageJobPayload>;

      logger.info(
        {
          jobId: job.id,
          messageId: validated.messageId,
          conversationId: validated.conversationId,
          platform: validated.platformType,
        },
        'Message enqueued for delivery'
      );

      return job;
    } catch (error) {
      logger.error(
        { error, payload },
        'Failed to enqueue message - validation error'
      );
      throw error;
    }
  }

  /**
   * Register job processor
   */
  private async registerProcessor(
    processor: (job: Job<SendMessageJobPayload>) => Promise<void>
  ): Promise<void> {
    try {
      const redisConnection = getRedisClient();
      
      this.worker = new Worker<SendMessageJobPayload>(
        QUEUE_NAMES.MESSAGE_QUEUE,
        processor,
        {
          connection: redisConnection,
          concurrency: RETRY_CONFIG.CONCURRENCY,
        }
      );

      // Event handlers
      this.worker.on('completed', (job: Job<SendMessageJobPayload>) => {
        void this.handleJobCompleted(job);
      });

      this.worker.on('failed', (job: Job<SendMessageJobPayload> | undefined, err: Error) => {
        if (job) {
          void this.handleJobFailed(job, err);
        }
      });

      logger.info(
        {
          concurrency: RETRY_CONFIG.CONCURRENCY,
          maxAttempts: RETRY_CONFIG.MAX_ATTEMPTS,
        },
        'Message queue processor registered'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to register message queue processor');
      throw error;
    }
  }

  /**
   * Handle job completion
   */
  private async handleJobCompleted(job: Job<SendMessageJobPayload>): Promise<void> {
    try {
      logger.info(
        {
          jobId: job.id,
          messageId: job.data.messageId,
          conversationId: job.data.conversationId,
          platform: job.data.platformType,
        },
        'Message job completed successfully'
      );

      // Emit completion event (placeholder - actual implementation depends on websocket gateway)
      const result: JobCompletionResult = {
        jobId: job.id || '',
        messageId: job.data.messageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      };

      logger.debug({ result }, 'Job completion event prepared');
      // TODO: Emit via websocket gateway when available
      // await emitGlobally('queue.message_sent', { ... });
    } catch (error) {
      logger.error({ error, jobId: job.id }, 'Error handling job completion');
    }
  }

  /**
   * Handle job failure
   */
  private async handleJobFailed(job: Job<SendMessageJobPayload>, error: Error): Promise<void> {
    try {
      const attemptNumber = job.attemptsMade || 0;
      const maxAttempts = RETRY_CONFIG.MAX_ATTEMPTS;

      logger.warn(
        {
          jobId: job.id,
          messageId: job.data.messageId,
          attempt: attemptNumber,
          maxAttempts,
          error: error.message,
        },
        'Message job failed'
      );

      // If max retries exceeded, move to DLQ
      if (attemptNumber >= maxAttempts) {
        await this.moveToDeadLetterQueue(job, error);
      } else {
        // Emit retry event
        const retryMetadata: JobRetryMetadata = {
          jobId: job.id || '',
          messageId: job.data.messageId,
          attemptNumber,
          maxAttempts,
          nextRetryTime: new Date(
            Date.now() + RETRY_CONFIG.BACKOFF_DELAYS[attemptNumber]
          ).toISOString(),
          error: error.message,
        };

        logger.info({ retryMetadata }, 'Job retry scheduled');
        // TODO: Emit via websocket gateway when available
        // await emitGlobally('queue.message_retry', { ... });
      }
    } catch (err) {
      logger.error({ error: err, jobId: job.id }, 'Error handling job failure');
    }
  }

  /**
   * Move job to dead-letter queue
   */
  private async moveToDeadLetterQueue(
    job: Job<SendMessageJobPayload>,
    error: Error
  ): Promise<void> {
    try {
      const dlqEntry: DLQEntry = {
        messageId: job.data.messageId,
        conversationId: job.data.conversationId,
        payload: job.data,
        failedAt: new Date().toISOString(),
        failureReason: FailureReason.MAX_RETRIES_EXCEEDED,
        totalAttempts: job.attemptsMade || RETRY_CONFIG.MAX_ATTEMPTS,
        lastError: error.message,
      };

      // Validate entry before adding
      DLQEntrySchema.parse(dlqEntry);

      // BullMQ v5+ uses positional args: queue.add(jobName, data, options)
      await this.dlqQueue.add(
        'dlq-entry',
        dlqEntry,
        {
          jobId: `dlq-${job.data.messageId}`,
        }
      );

      logger.error(
        {
          jobId: job.id,
          messageId: job.data.messageId,
          conversationId: job.data.conversationId,
          attempts: job.attemptsMade,
          error: error.message,
          correlationId: job.data.correlationId,
        },
        'Message moved to dead-letter queue'
      );

      // Record in database that message is in DLQ (with traceability context)
      await queueDatabaseIntegration.recordMessageInDLQ(
        job.data,
        FailureReason.MAX_RETRIES_EXCEEDED,
        job.attemptsMade || RETRY_CONFIG.MAX_ATTEMPTS,
        error.message,
        {
          jobId: job.id,
          correlationId: job.data.correlationId,
        }
      );

      // TODO: Emit via websocket gateway when available
      // await emitGlobally('queue.message_dlq', { ... });
    } catch (dlqError) {
      logger.error(
        { error: dlqError, jobId: job.id },
        'Failed to move message to dead-letter queue'
      );
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics(): Promise<QueueStatistics> {
    try {
      const [active, waiting, completed, failed, delayed] = await Promise.all([
        this.messageQueue.getActiveCount(),
        this.messageQueue.getWaitingCount(),
        this.messageQueue.getCompletedCount(),
        this.messageQueue.getFailedCount(),
        this.messageQueue.getDelayedCount(),
      ]);

      const dlqCount = await this.dlqQueue.count();

      return {
        active,
        waiting,
        completed,
        failed,
        delayed,
        dlq: dlqCount,
        totalJobs: active + waiting + completed + failed + delayed + dlqCount,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get queue statistics');
      throw error;
    }
  }

  /**
   * Get a specific job
   */
  async getJob(jobId: string): Promise<Job<SendMessageJobPayload> | undefined> {
    try {
      return await this.messageQueue.getJob(jobId);
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to get job');
      throw error;
    }
  }

  /**
   * Retry a failed job
   */
  async retryFailedJob(messageId: string): Promise<void> {
    try {
      const jobId = `msg-${messageId}`;
      const job = await this.getJob(jobId);

      if (!job) {
        throw new Error(`Job not found for message ${messageId}`);
      }

      await job.retry();
      logger.info({ messageId, jobId }, 'Job retry initiated');
    } catch (error) {
      logger.error({ error, messageId }, 'Failed to retry job');
      throw error;
    }
  }

  /**
   * Get DLQ entries
   */
  async getDLQEntries(limit: number = 100): Promise<DLQEntry[]> {
    try {
      const jobs = await this.dlqQueue.getJobs(['completed', 'failed'], 0, limit - 1);
      return jobs.map((job) => job.data as DLQEntry);
    } catch (error) {
      logger.error({ error }, 'Failed to get DLQ entries');
      return [];
    }
  }

  /**
   * Clear DLQ entry
   */
  async clearDLQEntry(messageId: string): Promise<void> {
    try {
      const jobId = `dlq-${messageId}`;
      await this.dlqQueue.remove(jobId);
      logger.info({ messageId }, 'DLQ entry cleared');
    } catch (error) {
      logger.error({ error, messageId }, 'Failed to clear DLQ entry');
      throw error;
    }
  }

  /**
   * Cleanup - close queues and worker
   */
  async close(): Promise<void> {
    try {
      if (this.worker) {
        await this.worker.close();
      }
      await this.messageQueue.close();
      await this.dlqQueue.close();
      this.isInitialized = false;
      logger.info('Message queue service closed');
    } catch (error) {
      logger.error({ error }, 'Error closing message queue service');
    }
  }

  /**
   * Setup event listeners for monitoring
   */
  private setupEventListeners(): void {
    this.messageQueue.on('error', (error: Error) => {
      logger.error({ error }, 'Message queue error');
    });

    this.dlqQueue.on('error', (error: Error) => {
      logger.error({ error }, 'DLQ queue error');
    });
  }

  /**
   * Drain all queues (for testing)
   */
  async drainQueues(): Promise<void> {
    try {
      await this.messageQueue.drain();
      await this.dlqQueue.drain();
      logger.info('All message queues drained');
    } catch (error) {
      logger.error({ error }, 'Failed to drain queues');
      throw error;
    }
  }
}

// Export singleton instance
export const messageQueueService = new MessageQueueService();
