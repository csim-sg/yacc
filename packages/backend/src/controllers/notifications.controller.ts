/**
 * Notifications Controller
 * Handles notification CRUD endpoints
 */

import type { Request } from 'express';
import {
  JsonController,
  Get,
  Patch,
  Delete,
  Post,
  Param,
  Body,
  Req,
  Authorized,
  CurrentUser,
  HttpCode,
  BadRequestError,
  NotFoundError,
  QueryParam,
} from 'routing-controllers';
import { logger } from '../infrastructure/logger';
import type { AuthUser } from '../types/auth.types';
import type { MarkNotificationReadRequest } from '../types/notifications.types';
import { notificationsService } from '../services/notifications.service';

interface AuthenticatedRequest extends Request {
  correlationId?: string;
}

/**
 * Notifications API endpoints
 * All authenticated users can manage their own notifications
 */
@JsonController('/notifications')
@Authorized()
export class NotificationsController {
  /**
   * GET /notifications
   * List current user's notifications with pagination
   * Users can only see their own notifications
   */
  @Get()
  @HttpCode(200)
  async listNotifications(
    @Req() req: AuthenticatedRequest,
    @QueryParam('page') page: string = '1',
    @QueryParam('pageSize') pageSize: string = '20',
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Parse pagination params
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

      logger.info(
        {
          userId: user.id,
          page: pageNum,
          limit,
          correlationId,
        },
        'Listing notifications'
      );

      const result = await notificationsService.listNotifications(user.id, pageNum, limit);

      logger.info(
        {
          userId: user.id,
          count: result.data.length,
          total: result.pagination.total,
          correlationId,
        },
        'Notifications listed successfully'
      );

      return {
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          userId: user.id,
          error: message,
          correlationId,
        },
        'Failed to list notifications'
      );

      throw new BadRequestError(message);
    }
  }

  /**
   * PATCH /notifications/:id
   * Mark a notification as read
   * Users can only mark their own notifications
   */
  @Patch('/:id')
  @HttpCode(200)
  async markNotificationRead(
    @Req() req: AuthenticatedRequest,
    @Param('id') notificationId: string,
    @Body() body: MarkNotificationReadRequest,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Validate request body
      if (typeof body.isRead !== 'boolean') {
        throw new BadRequestError('isRead must be a boolean');
      }

      logger.info(
        {
          userId: user.id,
          notificationId,
          isRead: body.isRead,
          correlationId,
        },
        'Marking notification as read'
      );

      // Mark as read (always true for this endpoint)
      const result = await notificationsService.markNotificationRead(
        notificationId,
        user.id
      );

      logger.info(
        {
          userId: user.id,
          notificationId,
          correlationId,
        },
        'Notification marked as read'
      );

      return { data: result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          userId: user.id,
          notificationId,
          error: message,
          correlationId,
        },
        'Failed to mark notification as read'
      );

      if (message.includes('not found') || message.includes('access denied')) {
        throw new NotFoundError(message);
      }
      throw new BadRequestError(message);
    }
  }

  /**
   * DELETE /notifications/:id
   * Dismiss a notification
   * Users can only dismiss their own notifications
   */
  @Delete('/:id')
  @HttpCode(204)
  async dismissNotification(
    @Req() req: AuthenticatedRequest,
    @Param('id') notificationId: string,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      logger.info(
        {
          userId: user.id,
          notificationId,
          correlationId,
        },
        'Dismissing notification'
      );

      await notificationsService.dismissNotification(notificationId, user.id);

      logger.info(
        {
          userId: user.id,
          notificationId,
          correlationId,
        },
        'Notification dismissed'
      );

      return;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          userId: user.id,
          notificationId,
          error: message,
          correlationId,
        },
        'Failed to dismiss notification'
      );

      if (message.includes('not found') || message.includes('access denied')) {
        throw new NotFoundError(message);
      }
      throw new BadRequestError(message);
    }
  }

  /**
   * POST /notifications/mark-all-read
   * Mark all notifications as read for current user
   */
  @Post('/mark-all-read')
  @HttpCode(200)
  async markAllNotificationsRead(
    @Req() req: AuthenticatedRequest,
    @CurrentUser() user: AuthUser
  ) {
    const correlationId = req.correlationId || 'unknown';

    try {
      logger.info(
        {
          userId: user.id,
          correlationId,
        },
        'Marking all notifications as read'
      );

      const count = await notificationsService.markAllNotificationsRead(user.id);

      logger.info(
        {
          userId: user.id,
          count,
          correlationId,
        },
        'All notifications marked as read'
      );

      return { data: { markedCount: count } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          userId: user.id,
          error: message,
          correlationId,
        },
        'Failed to mark all notifications as read'
      );

      throw new BadRequestError(message);
    }
  }
}
