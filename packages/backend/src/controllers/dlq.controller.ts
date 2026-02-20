/**
 * Dead Letter Queue Controller
 * 
 * API endpoints for ops to view and manage dead letter queue
 * 
 * RBAC Policy:
 * - READ endpoints (list, stats): manager, admin, super_admin
 * - MUTATE endpoints (re-queue): admin, super_admin (manager is read-only)
 * - DELETE endpoint (delete): super_admin only
 * 
 * Contract:
 * - messageId: UUID FK to messages.id (enforced by dlqService)
 * - External/job IDs: stored in metadata, not as messageId
 * - Traceability: correlationId, ircProfileId, externalThreadId, externalThreadType
 */

import type { Request, Response } from 'express';
import {
  JsonController,
  Get,
  Post,
  Delete,
  Param,
  QueryParams,
  Req,
  Res,
  Authorized,
} from 'routing-controllers';
import { logger } from '../infrastructure/logger.js';
import { dlqService } from '../services/dlq.service.js';
import type { AuthUser } from '../types/auth.types.js';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
  user?: AuthUser;
}

interface DLQQueryParams {
  page?: string;
  limit?: string;
  failureReason?: string;
}

@JsonController('/api/dlq')
export class DLQController {
  /**
   * GET /api/dlq
   * List dead letter queue entries with pagination
   * Requires: manager+ role (READ)
   */
  @Get()
  @Authorized(['manager', 'admin', 'super_admin'])
  async listDLQEntries(
    @QueryParams() query: DLQQueryParams,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {

      // Parse pagination parameters
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 25;

      if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1 || limit > 100) {
        logger.warn(
          {
            correlationId,
            page,
            limit,
          },
          'Invalid pagination parameters'
        );
        res.status(400).json({
          error: 'Invalid pagination: page must be ≥1, limit must be 1-100',
        });
        return;
      }

      // Query DLQ
      const result = await dlqService.getDLQEntries({
        page,
        limit,
        failureReason: query.failureReason,
      });

      logger.debug(
        {
          page,
          limit,
          total: result.total,
          failureReason: query.failureReason,
          userId,
          userRole,
          correlationId,
        },
        'DLQ entries retrieved'
      );

      res.status(200).json({
        entries: result.entries,
        total: result.total,
        page: result.page,
        limit: result.limit,
      });
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to list DLQ entries'
      );

      res.status(500).json({ error: 'Failed to retrieve DLQ entries' });
    }
  }

  /**
   * GET /api/dlq/stats
   * Get DLQ statistics (counts by failure reason, etc.)
   * Requires: manager+ role (READ)
   */
  @Get('/stats')
  async getDLQStats(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userId = req.user?.id;

    try {
      // Get statistics
      const stats = await dlqService.getDLQStatistics();

      logger.debug(
        {
          total: stats.total,
          failureReasons: Object.keys(stats.byFailureReason).length,
          userId,
          correlationId,
        },
        'DLQ statistics retrieved'
      );

      res.status(200).json(stats);
    } catch (error) {
      logger.error(
        {
          correlationId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to get DLQ statistics'
      );

      res.status(500).json({ error: 'Failed to retrieve DLQ statistics' });
    }
  }

  /**
   * POST /api/dlq/:id/re-queue
   * Move DLQ entry back to retry queue for manual retry
   * Requires: admin+ role (MUTATE - manager read-only)
   */
  @Post('/:id/re-queue')
  @Authorized(['admin', 'super_admin'])
  async reQueueFromDLQ(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userId = req.user?.id;

    try {
      // Get DLQ entry
      const entry = await dlqService.getDLQEntry(id);
      if (!entry) {
        logger.warn(
          {
            correlationId,
            dlqId: id,
            userId,
          },
          'DLQ entry not found'
        );
        res.status(404).json({ error: 'DLQ entry not found' });
        return;
      }

      // Mark as retried
      const updated = await dlqService.markAsRetried(id, userId || 'unknown');

      logger.info(
        {
          dlqId: id,
          messageId: updated.messageId,
          conversationId: updated.conversationId,
          retriedBy: userId,
          correlationId,
        },
        'DLQ entry marked for retry'
      );

      res.status(200).json({
        message: 'Entry marked for manual retry',
        entry: updated,
      });
    } catch (error) {
      logger.error(
        {
          correlationId,
          dlqId: id,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to re-queue DLQ entry'
      );

      res.status(500).json({ error: 'Failed to re-queue DLQ entry' });
    }
  }

  /**
   * DELETE /api/dlq/:id
   * Remove DLQ entry (after ops review/resolution)
   * Requires: super_admin only (MUTATE - strict access control)
   */
  @Delete('/:id')
  async removeDLQEntry(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response
  ): Promise<void> {
    const correlationId = req.correlationId || 'unknown';
    const userId = req.user?.id;

    try {
      // Get entry first (verify it exists)
      const entry = await dlqService.getDLQEntry(id);
      if (!entry) {
        logger.warn(
          {
            correlationId,
            dlqId: id,
            userId,
          },
          'DLQ entry not found for deletion'
        );
        res.status(404).json({ error: 'DLQ entry not found' });
        return;
      }

      // Remove
      const result = await dlqService.removeDLQEntry(id);

      if (result) {
        logger.info(
          {
            dlqId: id,
            messageId: entry.messageId,
            conversationId: entry.conversationId,
            deletedBy: userId,
            correlationId,
          },
          'DLQ entry deleted'
        );

        res.status(200).json({
          message: 'DLQ entry deleted successfully',
          deletedEntry: {
            id: entry.id,
            messageId: entry.messageId,
            conversationId: entry.conversationId,
            failureReason: entry.failureReason,
          },
        });
      } else {
        res.status(500).json({ error: 'Failed to delete DLQ entry' });
      }
    } catch (error) {
      logger.error(
        {
          correlationId,
          dlqId: id,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to delete DLQ entry'
      );

      res.status(500).json({ error: 'Failed to delete DLQ entry' });
    }
  }
}
