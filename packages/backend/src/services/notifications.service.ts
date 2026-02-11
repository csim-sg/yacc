/**
 * Notifications Service
 * Handles notification CRUD operations and deduplication
 */

import { eq, desc, and } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { notifications } from '../schemas/notification.schema';
import { users } from '../schemas/user.schema';
import type {
  NotificationResponse,
  ListNotificationsResponse,
  CreateNotificationParams,
} from '../types/notifications.types';

export class NotificationsService {
  /**
   * Create a notification with deduplication
   * Notifications are deduplicated by (user_id, conversation_id, type)
   * On duplicate, the notification is updated with new created_at
   */
  async createNotification(params: CreateNotificationParams): Promise<NotificationResponse> {
    const { userId, type, conversationId, actorId, message, metadata } = params;

    try {
      // Validate user exists
      const user = await dbClient
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (user.length === 0) {
        throw new Error('User not found');
      }

      // Try to insert notification (deduped on unique constraint)
      const result = await dbClient
        .insert(notifications)
        .values({
          userId,
          type,
          conversationId: conversationId || null,
          actorId: actorId || null,
          message,
          metadata: metadata || null,
        })
        .onConflictDoNothing()
        .returning();

      // If no result from insert (duplicate), fetch existing
      let notification;
      if (result.length === 0) {
        let whereCondition;
        if (conversationId) {
          whereCondition = and(
            eq(notifications.userId, userId),
            eq(notifications.type, type),
            eq(notifications.conversationId, conversationId)
          );
        } else {
          // For null conversationId, we need a different approach
          const existing = await dbClient
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, userId),
                eq(notifications.type, type)
              )
            );

          const nullConvNotification = existing.find(
            (n) => n.conversationId === null
          );

          if (!nullConvNotification) {
            throw new Error('Failed to create or retrieve notification');
          }
          notification = nullConvNotification;

          logger.info(
            { notificationId: notification.id, userId, type },
            'Notification deduplicated (null conversationId)'
          );

          return this.notificationToResponse(notification);
        }

        const existing = await dbClient
          .select()
          .from(notifications)
          .where(whereCondition)
          .limit(1);

        if (existing.length === 0) {
          throw new Error('Failed to create or retrieve notification');
        }
        notification = existing[0];
      } else {
        notification = result[0];
      }

      logger.info(
        { notificationId: notification.id, userId, type, conversationId },
        'Notification created or deduplicated'
      );

      return this.notificationToResponse(notification);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { userId, type, conversationId, error: message },
        'Failed to create notification'
      );
      throw error;
    }
  }

  /**
   * List notifications for a user with pagination
   * Users can only see their own notifications
   */
  async listNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ListNotificationsResponse> {
    try {
      // Validate pagination
      const pageNum = Math.max(1, page);
      const pageLimit = Math.min(100, Math.max(1, limit));
      const offset = (pageNum - 1) * pageLimit;

      // Count total notifications for user
      const countResult = await dbClient
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId));

      const total = countResult.length;

      // Fetch paginated notifications (most recent first)
      const notificationList = await dbClient
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(pageLimit)
        .offset(offset);

      logger.info(
        { userId, page: pageNum, limit: pageLimit, total },
        'Notifications listed'
      );

      return {
        data: notificationList.map((n) => this.notificationToResponse(n)),
        pagination: {
          page: pageNum,
          limit: pageLimit,
          total,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ userId, page, limit, error: message }, 'Failed to list notifications');
      throw error;
    }
  }

  /**
   * Mark a notification as read
   * Users can only mark their own notifications
   */
  async markNotificationRead(notificationId: string, userId: string): Promise<NotificationResponse> {
    try {
      // Verify notification exists and belongs to user
      const notification = await dbClient
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        )
        .limit(1);

      if (notification.length === 0) {
        throw new Error('Notification not found or access denied');
      }

      // Update notification to mark as read
      const result = await dbClient
        .update(notifications)
        .set({
          isRead: true,
        })
        .where(eq(notifications.id, notificationId))
        .returning();

      if (result.length === 0) {
        throw new Error('Failed to mark notification as read');
      }

      logger.info({ notificationId, userId }, 'Notification marked as read');

      return this.notificationToResponse(result[0]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ notificationId, userId, error: message }, 'Failed to mark notification read');
      throw error;
    }
  }

  /**
   * Dismiss (delete) a notification
   * Users can only dismiss their own notifications
   */
  async dismissNotification(notificationId: string, userId: string): Promise<void> {
    try {
      // Verify notification exists and belongs to user
      const notification = await dbClient
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        )
        .limit(1);

      if (notification.length === 0) {
        throw new Error('Notification not found or access denied');
      }

      // Delete notification
      await dbClient.delete(notifications).where(eq(notifications.id, notificationId));

      logger.info({ notificationId, userId }, 'Notification dismissed');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ notificationId, userId, error: message }, 'Failed to dismiss notification');
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsRead(userId: string): Promise<number> {
    try {
      // Get all unread notifications for user
      const unreadNotifications = await dbClient
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false)
          )
        );

      if (unreadNotifications.length === 0) {
        logger.info({ userId }, 'No unread notifications to mark');
        return 0;
      }

      // Update all to read
      await dbClient
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false)
          )
        );

      logger.info(
        { userId, count: unreadNotifications.length },
        'All notifications marked as read'
      );

      return unreadNotifications.length;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ userId, error: message }, 'Failed to mark all notifications read');
      throw error;
    }
  }

  /**
   * Convert notification database row to response DTO
   */
  private notificationToResponse(notification: typeof notifications.$inferSelect): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type as 'assignment' | 'mention',
      conversationId: notification.conversationId,
      actorId: notification.actorId,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}

export const notificationsService = new NotificationsService();
