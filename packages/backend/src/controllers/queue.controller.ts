import type { Request, Response } from 'express';
import {
  Body,
  Get,
  JsonController,
  Param,
  Post,
  QueryParam,
  Req,
  Res,
  Authorized,
} from 'routing-controllers';
import { logger } from '../infrastructure/logger';
import { messageQueueDLQService } from '../services/message-queue-dlq.service.js';
import { messageQueueService } from '../services/message-queue.service.js';
import type { AuthUser } from '../types/auth.types.js';
import type { QueueStatistics } from '../types/message-queue.types.js';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
  user?: AuthUser;
}

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

type _QueueStatsResponse = {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
  dlq: number;
  totalJobs: number;
  timestamp: string;
};

type _DLQListResponse = {
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
};

type _RetryResponse = {
  success: boolean;
  messageId: string;
  message: string;
  timestamp: string;
};

type BulkRetryRequest = {
  messageIds: string[];
};

type _BulkRetryResponse = {
  successful: number;
  failed: number;
  errors: Array<{ messageId: string; error: string }>;
  timestamp: string;
};

@JsonController('/api/queue')
@Authorized()
export class QueueController {
  /**
   * GET /api/queue/stats
   *
   * Get current queue statistics
   * Requires: manager+ role
   */
  @Get('/stats')
  async getQueueStats(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userRole = req.user?.role;

    try {
      // Check authorization (manager+)
      const allowedRoles = ['manager', 'admin', 'super_admin'];
      if (!allowedRoles.includes(userRole || '')) {
        logger.warn(
          {
            correlationId,
            userId: req.user?.id,
            userRole,
          },
          'Unauthorized queue stats attempt'
        );
        res.status(403).json({ error: 'Only managers and above can view queue statistics' });
        return;
      }

      const stats: QueueStatistics = await messageQueueService.getQueueStatistics();

      logger.debug({ stats, correlationId }, 'Retrieved queue statistics');

      res.status(200).json({
        ...stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId: req.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to get queue statistics'
      );
      res.status(500).json({ error: 'Failed to retrieve queue statistics' });
    }
  }

  /**
   * GET /api/queue/dlq
   *
   * Get dead-letter queue entries with pagination
   * Requires: manager+ role
   */
  @Get('/dlq')
  async getDLQEntries(
    @QueryParam('page') page: number = 1,
    @QueryParam('pageSize') pageSize: number = 20,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userRole = req.user?.role;

    try {
      // Check authorization (manager+)
      const allowedRoles = ['manager', 'admin', 'super_admin'];
      if (!allowedRoles.includes(userRole || '')) {
        logger.warn(
          {
            correlationId,
            userId: req.user?.id,
            userRole,
          },
          'Unauthorized queue DLQ list attempt'
        );
        res.status(403).json({ error: 'Only managers and above can view DLQ' });
        return;
      }

      const offset = (page - 1) * pageSize;
      const { entries, total } = await messageQueueDLQService.getDLQEntries(
        pageSize,
        offset
      );

      logger.debug(
        { page, pageSize, total: entries.length, correlationId },
        'Retrieved DLQ entries'
      );

      res.status(200).json({
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
      });
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId: req.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to get DLQ entries'
      );
      res.status(500).json({ error: 'Failed to retrieve DLQ entries' });
    }
  }

  /**
   * POST /api/queue/retry/:messageId
   *
   * Retry a failed message (move from DLQ back to main queue)
   * Requires: manager+ role
   */
  @Post('/retry/:messageId')
  async retryMessage(
    @Param('messageId') messageId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userRole = req.user?.role;
    const userId = req.user?.id;

    try {
      // Check authorization (manager+)
      const allowedRoles = ['manager', 'admin', 'super_admin'];
      if (!allowedRoles.includes(userRole || '')) {
        logger.warn(
          {
            correlationId,
            userId,
            userRole,
            messageId,
          },
          'Unauthorized message retry attempt'
        );
        res.status(403).json({ error: 'Only managers and above can retry messages' });
        return;
      }

      await messageQueueDLQService.retryDLQEntry(messageId);

      logger.info(
        { messageId, userId, correlationId },
        'Message retry initiated via API'
      );

      res.status(200).json({
        success: true,
        messageId,
        message: 'Message re-enqueued for delivery',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId,
          messageId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to retry message'
      );
      res.status(500).json({ error: 'Failed to retry message' });
    }
  }

  /**
   * POST /api/queue/dlq/retry
   *
   * Bulk retry multiple failed messages
   * Requires: manager+ role
   */
  @Post('/dlq/retry')
  async bulkRetryDLQ(
    @Body() request: BulkRetryRequest,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userRole = req.user?.role;
    const userId = req.user?.id;

    try {
      // Check authorization (manager+)
      const allowedRoles = ['manager', 'admin', 'super_admin'];
      if (!allowedRoles.includes(userRole || '')) {
        logger.warn(
          {
            correlationId,
            userId,
            userRole,
          },
          'Unauthorized bulk retry attempt'
        );
        res.status(403).json({ error: 'Only managers and above can bulk retry messages' });
        return;
      }

      if (!request.messageIds || !Array.isArray(request.messageIds)) {
        logger.warn({ correlationId }, 'Invalid bulk retry request: messageIds must be an array');
        res.status(400).json({ error: 'messageIds must be an array' });
        return;
      }

      if (request.messageIds.length === 0) {
        logger.warn({ correlationId }, 'Invalid bulk retry request: messageIds array cannot be empty');
        res.status(400).json({ error: 'messageIds array cannot be empty' });
        return;
      }

      if (request.messageIds.length > 100) {
        logger.warn(
          { correlationId, count: request.messageIds.length },
          'Invalid bulk retry request: too many messages'
        );
        res.status(400).json({ error: 'Maximum 100 messages per bulk retry' });
        return;
      }

      const result = await messageQueueDLQService.bulkRetryDLQEntries(
        request.messageIds
      );

      logger.info(
        {
          total: request.messageIds.length,
          successful: result.successful,
          failed: result.failed,
          userId,
          correlationId,
        },
        'Bulk DLQ retry completed'
      );

      res.status(200).json({
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to bulk retry DLQ entries'
      );
      res.status(500).json({ error: 'Failed to bulk retry DLQ entries' });
    }
  }

  /**
   * GET /api/queue/dlq/stats
   *
   * Get DLQ statistics and analysis
   * Requires: manager+ role
   */
  @Get('/dlq/stats')
  async getDLQStats(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userRole = req.user?.role;

    try {
      // Check authorization (manager+)
      const allowedRoles = ['manager', 'admin', 'super_admin'];
      if (!allowedRoles.includes(userRole || '')) {
        logger.warn(
          {
            correlationId,
            userId: req.user?.id,
            userRole,
          },
          'Unauthorized DLQ stats attempt'
        );
        res.status(403).json({ error: 'Only managers and above can view DLQ statistics' });
        return;
      }

      const [stats, analysis] = await Promise.all([
        messageQueueDLQService.getDLQStats(),
        messageQueueDLQService.analyzeDLQPatterns(),
      ]);

      logger.debug(
        { stats, analysis, correlationId },
        'Retrieved DLQ statistics'
      );

      res.status(200).json({
        stats,
        analysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId: req.user?.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to get DLQ statistics'
      );
      res.status(500).json({ error: 'Failed to retrieve DLQ statistics' });
    }
  }

  /**
   * GET /api/queue/job/:jobId
   *
   * Get details of a specific job
   * Requires: manager+ role
   */
  @Get('/job/:jobId')
  async getJob(
    @Param('jobId') jobId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userRole = req.user?.role;

    try {
      // Check authorization (manager+)
      const allowedRoles = ['manager', 'admin', 'super_admin'];
      if (!allowedRoles.includes(userRole || '')) {
        logger.warn(
          {
            correlationId,
            userId: req.user?.id,
            userRole,
            jobId,
          },
          'Unauthorized job details attempt'
        );
        res.status(403).json({ error: 'Only managers and above can view job details' });
        return;
      }

      const job = await messageQueueService.getJob(jobId);

      if (!job) {
        logger.debug({ jobId, correlationId }, 'Job not found');
        res.status(404).json({
          success: false,
          message: 'Job not found',
          jobId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      logger.debug({ jobId, correlationId }, 'Retrieved job details');

      res.status(200).json({
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
      });
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId: req.user?.id,
          jobId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to get job details'
      );
      res.status(500).json({ error: 'Failed to retrieve job details' });
    }
  }

  /**
   * POST /api/queue/dlq/clear/:messageId
   *
   * Clear a DLQ entry (mark as processed/resolved)
   * Requires: super_admin only (strict access control)
   */
  @Post('/dlq/clear/:messageId')
  async clearDLQEntry(
    @Param('messageId') messageId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userRole = req.user?.role;
    const userId = req.user?.id;

    try {
      // Check authorization (super_admin only)
      if (userRole !== 'super_admin') {
        logger.warn(
          {
            correlationId,
            userId,
            userRole,
            messageId,
          },
          'Unauthorized DLQ clear attempt'
        );
        res.status(403).json({ error: 'Only super admins can clear DLQ entries' });
        return;
      }

      await messageQueueDLQService.clearDLQEntry(messageId);

      logger.info(
        { messageId, userId, correlationId },
        'DLQ entry cleared via API'
      );

      res.status(200).json({
        success: true,
        messageId,
        message: 'DLQ entry cleared and marked as processed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId,
          messageId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to clear DLQ entry'
      );
      res.status(500).json({ error: 'Failed to clear DLQ entry' });
    }
  }

  /**
   * GET /api/queue/dlq/by-reason/:reason
   *
   * Get DLQ entries filtered by failure reason
   * Requires: manager+ role
   */
  @Get('/dlq/by-reason/:reason')
  async getDLQEntriesByReason(
    @Param('reason') reason: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userRole = req.user?.role;

    try {
      // Check authorization (manager+)
      const allowedRoles = ['manager', 'admin', 'super_admin'];
      if (!allowedRoles.includes(userRole || '')) {
        logger.warn(
          {
            correlationId,
            userId: req.user?.id,
            userRole,
            reason,
          },
          'Unauthorized DLQ entries by reason attempt'
        );
        res.status(403).json({ error: 'Only managers and above can filter DLQ entries' });
        return;
      }

      const entries = await messageQueueDLQService.getDLQEntriesByReason(reason);

      logger.debug(
        { reason, count: entries.length, correlationId },
        'Retrieved DLQ entries by reason'
      );

      res.status(200).json({
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
      });
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId: req.user?.id,
          reason,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to get DLQ entries by reason'
      );
      res.status(500).json({ error: 'Failed to retrieve DLQ entries by reason' });
    }
  }
}
