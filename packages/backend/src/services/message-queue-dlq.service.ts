import type { DLQEntry } from '../types/message-queue.types';

import { logger } from '../infrastructure/logger';
import { messageQueueService } from './messageQueue.service';

/**
 * Dead-Letter Queue (DLQ) Handler Service
 *
 * Manages failed messages that have exhausted all retry attempts.
 * Responsibilities:
 * - Retrieve DLQ entries for admin review
 * - Manual retry capability (move back to main queue)
 * - Clear/archive DLQ entries
 * - Emit admin notifications
 *
 * DLQ entries are stored for 7 days before auto-cleanup.
 */

class MessageQueueDLQService {
  /**
   * Get all DLQ entries with pagination
   */
  async getDLQEntries(
    limit: number = 100,
    offset: number = 0
  ): Promise<{ entries: DLQEntry[]; total: number }> {
    try {
      const entries = await messageQueueService.getDLQEntries(limit);

      logger.debug(
        { count: entries.length, limit, offset },
        'Retrieved DLQ entries'
      );

      return {
        entries,
        total: entries.length, // Note: BullMQ doesn't provide exact count easily
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get DLQ entries');
      throw error;
    }
  }

  /**
   * Get a single DLQ entry by message ID
   */
  async getDLQEntry(messageId: string): Promise<DLQEntry | null> {
    try {
      const entries = await messageQueueService.getDLQEntries(1000);
      const entry = entries.find((e) => e.messageId === messageId);

      if (!entry) {
        logger.warn({ messageId }, 'DLQ entry not found');
        return null;
      }

      logger.debug({ messageId }, 'Retrieved DLQ entry');
      return entry;
    } catch (error) {
      logger.error({ error, messageId }, 'Failed to get DLQ entry');
      throw error;
    }
  }

  /**
   * Clear a DLQ entry (mark as resolved/processed)
   */
  async clearDLQEntry(messageId: string): Promise<void> {
    try {
      await messageQueueService.clearDLQEntry(messageId);

      logger.info(
        { messageId },
        'DLQ entry cleared - marked as processed'
      );

      // TODO: Emit notification to admin
      // await notificationService.notifyAdmins({
      //   type: 'dlq.entry_cleared',
      //   messageId,
      //   timestamp: new Date().toISOString(),
      // });
    } catch (error) {
      logger.error({ error, messageId }, 'Failed to clear DLQ entry');
      throw error;
    }
  }

  /**
   * Retry a failed message (move from DLQ back to main queue)
   *
   * Useful when the underlying issue is fixed and the message should be retried.
   */
  async retryDLQEntry(messageId: string): Promise<void> {
    try {
      // Get the DLQ entry
      const entry = await this.getDLQEntry(messageId);

      if (!entry) {
        throw new Error(`DLQ entry not found for message: ${messageId}`);
      }

      logger.info(
        {
          messageId,
          conversationId: entry.conversationId,
          totalAttempts: entry.totalAttempts,
          lastError: entry.lastError,
        },
        'Retrying failed message from DLQ'
      );

      // Re-enqueue the message for retry
      await messageQueueService.enqueueMessage(entry.payload);

      // Clear from DLQ after successful re-enqueue
      await this.clearDLQEntry(messageId);

      logger.info(
        { messageId },
        'Failed message re-enqueued from DLQ'
      );

      // TODO: Emit success notification
      // await notificationService.notifyAdmins({
      //   type: 'dlq.entry_retried',
      //   messageId,
      //   timestamp: new Date().toISOString(),
      // });
    } catch (error) {
      logger.error({ error, messageId }, 'Failed to retry DLQ entry');
      throw error;
    }
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(): Promise<{
    totalEntries: number;
    byFailureReason: Record<string, number>;
    oldestEntry: DLQEntry | null;
    newestEntry: DLQEntry | null;
  }> {
    try {
      const entries = await messageQueueService.getDLQEntries(1000);

      // Count by failure reason
      const byFailureReason: Record<string, number> = {};
      for (const entry of entries) {
        const reason = entry.failureReason;
        byFailureReason[reason] = (byFailureReason[reason] || 0) + 1;
      }

      // Find oldest and newest
      const sorted = entries.sort((a, b) => {
        const timeA = new Date(a.failedAt).getTime();
        const timeB = new Date(b.failedAt).getTime();
        return timeA - timeB;
      });

      const stats = {
        totalEntries: entries.length,
        byFailureReason,
        oldestEntry: sorted[0] || null,
        newestEntry: sorted[sorted.length - 1] || null,
      };

      logger.debug({ stats }, 'Generated DLQ statistics');
      return stats;
    } catch (error) {
      logger.error({ error }, 'Failed to get DLQ statistics');
      throw error;
    }
  }

  /**
   * Get DLQ entries by failure reason
   */
  async getDLQEntriesByReason(
    reason: string
  ): Promise<DLQEntry[]> {
    try {
      const entries = await messageQueueService.getDLQEntries(1000);
      const filtered = entries.filter((e) => e.failureReason === reason);

      logger.debug(
        { failureReason: reason, count: filtered.length },
        'Retrieved DLQ entries by reason'
      );

      return filtered;
    } catch (error) {
      logger.error({ error, reason }, 'Failed to get DLQ entries by reason');
      throw error;
    }
  }

  /**
   * Clear all DLQ entries older than specified days
   *
   * Used for maintenance/cleanup.
   */
  async clearOldDLQEntries(olderThanDays: number): Promise<number> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - olderThanDays);

      let clearedCount = 0;
      const entries = await messageQueueService.getDLQEntries(1000);

      for (const entry of entries) {
        const entryTime = new Date(entry.failedAt).getTime();
        if (entryTime < cutoffTime.getTime()) {
          await messageQueueService.clearDLQEntry(entry.messageId);
          clearedCount++;
        }
      }

      logger.info(
        { olderThanDays, clearedCount },
        'Cleaned up old DLQ entries'
      );

      return clearedCount;
    } catch (error) {
      logger.error({ error, olderThanDays }, 'Failed to clear old DLQ entries');
      throw error;
    }
  }

  /**
   * Analyze DLQ entries for patterns
   *
   * Returns insights about failure patterns to help identify systemic issues.
   */
  async analyzeDLQPatterns(): Promise<{
    topFailureReasons: Array<{ reason: string; count: number }>;
    avgAttemptsBeforeFailure: number;
    mostCommonError: string | null;
    conversationCount: number;
  }> {
    try {
      const entries = await messageQueueService.getDLQEntries(1000);

      if (entries.length === 0) {
        return {
          topFailureReasons: [],
          avgAttemptsBeforeFailure: 0,
          mostCommonError: null,
          conversationCount: 0,
        };
      }

      // Count failure reasons
      const reasonCounts: Record<string, number> = {};
      let totalAttempts = 0;
      const errorCounts: Record<string, number> = {};
      const conversations = new Set<string>();

      for (const entry of entries) {
        reasonCounts[entry.failureReason] =
          (reasonCounts[entry.failureReason] || 0) + 1;
        totalAttempts += entry.totalAttempts;
        errorCounts[entry.lastError] = (errorCounts[entry.lastError] || 0) + 1;
        conversations.add(entry.conversationId);
      }

      // Top failure reasons
      const topFailureReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Most common error
      const mostCommonError = Object.entries(errorCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      const analysis = {
        topFailureReasons,
        avgAttemptsBeforeFailure: totalAttempts / entries.length,
        mostCommonError,
        conversationCount: conversations.size,
      };

      logger.info({ analysis }, 'Generated DLQ pattern analysis');
      return analysis;
    } catch (error) {
      logger.error({ error }, 'Failed to analyze DLQ patterns');
      throw error;
    }
  }

  /**
   * Bulk retry multiple DLQ entries
   *
   * Useful when an infrastructure issue is resolved and multiple messages need retry.
   */
  async bulkRetryDLQEntries(messageIds: string[]): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ messageId: string; error: string }>;
  }> {
    try {
      const results = {
        successful: 0,
        failed: 0,
        errors: [] as Array<{ messageId: string; error: string }>,
      };

      for (const messageId of messageIds) {
        try {
          await this.retryDLQEntry(messageId);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            messageId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info(
        {
          total: messageIds.length,
          successful: results.successful,
          failed: results.failed,
        },
        'Bulk retry completed'
      );

      return results;
    } catch (error) {
      logger.error({ error }, 'Failed to bulk retry DLQ entries');
      throw error;
    }
  }
}

// Export singleton instance
export const messageQueueDLQService = new MessageQueueDLQService();
