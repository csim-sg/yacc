import { JsonController, Get, Post, Param, Body, QueryParam } from 'routing-controllers';
import { logger } from '../infrastructure/logger';
import { messageQueueService } from '../services/message-queue.service';
import { messageQueueDLQService } from '../services/message-queue-dlq.service';
import type { QueueStatistics } from '../types/message-queue.types';

/**
 * Queue Controller
 *
 * REST API endpoints for queue management and monitoring.
 * Allows admin operations on message retry queue and dead-letter queue.
 *
 * Endpoints:
 * - GET /api/queue/stats - Queue statistics
 * - GET /api/queue/dlq - List DLQ entries
 * - POST /api/queue/retry/{messageId} - Retry failed message
 * - GET /api/queue/job/{jobId} - Get job details
 * - GET /api/queue/dlq/stats - DLQ statistics
 * - POST /api/queue/dlq/retry - Bulk retry DLQ entries
 */

interface QueueStatsResponse {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  dlq: number;
  totalJobs: number;
  timestamp: string;
}

interface DLQListResponse {
  entries: Array<{
    messageId: string;
    conversationId: string;
    failedAt: string;
    failureReason: string;
    totalAttempts: number;
    lastError: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
  timestamp: string;
}

interface RetryResponse {
  success: boolean;
  messageId: string;
  message: string;
  timestamp: string;
}

interface BulkRetryRequest {
  messageIds: string[];
}

interface BulkRetryResponse {
  successful: number;
  failed: number;
  errors: Array<{ messageId: string; error: string }>;
  timestamp: string;
}

@JsonController('/api/queue')
export class QueueController {
  /**
   * GET /api/queue/stats
   *
   * Get current queue statistics
   */
  @Get('/stats')
  async getQueueStats(): Promise<QueueStatsResponse> {
    try {
      const stats: QueueStatistics = await messageQueueService.getQueueStatistics();

      logger.debug({ stats }, 'Retrieved queue statistics');

      return {
        ...stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get queue statistics');
      throw error;
    }
  }

  /**
   * GET /api/queue/dlq
   *
   * Get dead-letter queue entries with pagination
   */
  @Get('/dlq')
  async getDLQEntries(
    @QueryParam('page') page: number = 1,
    @QueryParam('pageSize') pageSize: number = 20
  ): Promise<DLQListResponse> {
    try {
      const offset = (page - 1) * pageSize;
      const { entries, total } = await messageQueueDLQService.getDLQEntries(
        pageSize,
        offset
      );

      logger.debug(
        { page, pageSize, total: entries.length },
        'Retrieved DLQ entries'
      );

      return {
        entries: entries.map((entry) => ({
          messageId: entry.messageId,
          conversationId: entry.conversationId,
          failedAt: entry.failedAt,
          failureReason: entry.failureReason,
          totalAttempts: entry.totalAttempts,
          lastError: entry.lastError,
        })),
        total,
        page,
        pageSize,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get DLQ entries');
      throw error;
    }
  }

  /**
   * POST /api/queue/retry/:messageId
   *
   * Retry a failed message (move from DLQ back to main queue)
   */
  @Post('/retry/:messageId')
  async retryMessage(
    @Param('messageId') messageId: string
  ): Promise<RetryResponse> {
    try {
      await messageQueueDLQService.retryDLQEntry(messageId);

      logger.info({ messageId }, 'Message retry initiated via API');

      return {
        success: true,
        messageId,
        message: 'Message re-enqueued for delivery',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, messageId }, 'Failed to retry message');
      throw error;
    }
  }

  /**
   * POST /api/queue/dlq/retry
   *
   * Bulk retry multiple failed messages
   */
  @Post('/dlq/retry')
  async bulkRetryDLQ(
    @Body() request: BulkRetryRequest
  ): Promise<BulkRetryResponse> {
    try {
      if (!request.messageIds || !Array.isArray(request.messageIds)) {
        throw new Error('messageIds must be an array');
      }

      if (request.messageIds.length === 0) {
        throw new Error('messageIds array cannot be empty');
      }

      if (request.messageIds.length > 100) {
        throw new Error('Maximum 100 messages per bulk retry');
      }

      const result = await messageQueueDLQService.bulkRetryDLQEntries(
        request.messageIds
      );

      logger.info(
        {
          total: request.messageIds.length,
          successful: result.successful,
          failed: result.failed,
        },
        'Bulk DLQ retry completed'
      );

      return {
        ...result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to bulk retry DLQ entries');
      throw error;
    }
  }

  /**
   * GET /api/queue/dlq/stats
   *
   * Get DLQ statistics and analysis
   */
  @Get('/dlq/stats')
  async getDLQStats() {
    try {
      const [stats, analysis] = await Promise.all([
        messageQueueDLQService.getDLQStats(),
        messageQueueDLQService.analyzeDLQPatterns(),
      ]);

      logger.debug({ stats, analysis }, 'Retrieved DLQ statistics');

      return {
        stats,
        analysis,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get DLQ statistics');
      throw error;
    }
  }

  /**
   * GET /api/queue/job/:jobId
   *
   * Get details of a specific job
   */
  @Get('/job/:jobId')
  async getJob(@Param('jobId') jobId: string) {
    try {
      const job = await messageQueueService.getJob(jobId);

      if (!job) {
        return {
          success: false,
          message: 'Job not found',
          jobId,
          timestamp: new Date().toISOString(),
        };
      }

      logger.debug({ jobId }, 'Retrieved job details');

      return {
        success: true,
        job: {
          id: job.id,
          name: job.name,
          data: job.data,
          state: await job.getState(),
          progress: job.progress as number,
          attemptsMade: job.attemptsMade,
          opts: {
            attempts: job.opts.attempts,
            backoff: job.opts.backoff,
          },
          failedReason: job.failedReason,
          stacktrace: job.stacktrace,
          createdAt: job.timestamp,
          finishedAt: job.finishedOn,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to get job details');
      throw error;
    }
  }

  /**
   * POST /api/queue/dlq/clear/:messageId
   *
   * Clear a DLQ entry (mark as processed/resolved)
   */
  @Post('/dlq/clear/:messageId')
  async clearDLQEntry(
    @Param('messageId') messageId: string
  ): Promise<RetryResponse> {
    try {
      await messageQueueDLQService.clearDLQEntry(messageId);

      logger.info({ messageId }, 'DLQ entry cleared via API');

      return {
        success: true,
        messageId,
        message: 'DLQ entry cleared and marked as processed',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, messageId }, 'Failed to clear DLQ entry');
      throw error;
    }
  }

  /**
   * GET /api/queue/dlq/by-reason/:reason
   *
   * Get DLQ entries filtered by failure reason
   */
  @Get('/dlq/by-reason/:reason')
  async getDLQEntriesByReason(@Param('reason') reason: string) {
    try {
      const entries = await messageQueueDLQService.getDLQEntriesByReason(reason);

      logger.debug(
        { reason, count: entries.length },
        'Retrieved DLQ entries by reason'
      );

      return {
        failureReason: reason,
        count: entries.length,
        entries: entries.map((e) => ({
          messageId: e.messageId,
          conversationId: e.conversationId,
          failedAt: e.failedAt,
          totalAttempts: e.totalAttempts,
          lastError: e.lastError,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ error, reason }, 'Failed to get DLQ entries by reason');
      throw error;
    }
  }
}
