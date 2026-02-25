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

import type { Request } from 'express';
import {
  JsonController,
  Get,
  Post,
  Delete,
  Param,
  QueryParams,
  Req,
  Authorized,
  HttpCode,
  BadRequestError,
  NotFoundError,
  InternalServerError,
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
  @HttpCode(200)
  async listDLQEntries(
    @QueryParams() query: DLQQueryParams,
    @Req() req: AuthenticatedRequest
  ): Promise<object> {
    const correlationId = req.correlationId || 'unknown';
    const userId = req.user?.id;
    const userRole = req.user?.role;

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
      throw new BadRequestError('Invalid pagination: page must be ≥1, limit must be 1-100');
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

    return {
      entries: result.entries,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  /**
   * GET /api/dlq/stats
   * Get DLQ statistics (counts by failure reason, etc.)
   * Requires: manager+ role (READ)
   */
  @Get('/stats')
  @Authorized(['manager', 'admin', 'super_admin'])
  @HttpCode(200)
  async getDLQStats(
    @Req() req: AuthenticatedRequest
  ): Promise<object> {
    const correlationId = req.correlationId || 'unknown';
    const userId = req.user?.id;

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

    return stats;
  }

  /**
   * POST /api/dlq/:id/re-queue
   * Move DLQ entry back to retry queue for manual retry
   * Requires: admin+ role (MUTATE - manager read-only)
   */
  @Post('/:id/re-queue')
  @Authorized(['admin', 'super_admin'])
  @HttpCode(200)
  async reQueueFromDLQ(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest
  ): Promise<object> {
    const correlationId = req.correlationId || 'unknown';
    const userId = req.user?.id;

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
      throw new NotFoundError('DLQ entry not found');
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

    return {
      message: 'Entry marked for manual retry',
      entry: updated,
    };
  }

  /**
   * DELETE /api/dlq/:id
   * Remove DLQ entry (after ops review/resolution)
   * Requires: super_admin only (MUTATE - strict access control)
   */
  @Delete('/:id')
  @Authorized(['super_admin'])
  @HttpCode(200)
  async removeDLQEntry(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest
  ): Promise<object> {
    const correlationId = req.correlationId || 'unknown';
    const userId = req.user?.id;

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
      throw new NotFoundError('DLQ entry not found');
    }

    // Remove
    const result = await dlqService.removeDLQEntry(id);

    if (!result) {
      logger.error(
        {
          correlationId,
          dlqId: id,
          userId,
        },
        'Failed to delete DLQ entry'
      );
      throw new InternalServerError('Failed to delete DLQ entry');
    }

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

    return {
      message: 'DLQ entry deleted successfully',
      deletedEntry: {
        id: entry.id,
        messageId: entry.messageId,
        conversationId: entry.conversationId,
        failureReason: entry.failureReason,
      },
    };
  }
}
