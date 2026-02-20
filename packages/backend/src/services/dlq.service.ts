/**
 * Dead Letter Queue Service
 *
 * Manages messages that failed after 3 retry attempts
 * Provides operations for viewing, re-queueing, and cleanup
 */

import { dbClient } from '../infrastructure/db.client.js';
import { deadLetterQueue } from '../schemas/deadLetterQueue.schema.js';
import { logger } from '../infrastructure/logger.js';
import { eq, desc, and, gte, lte, count, sql } from 'drizzle-orm';
import type { DeadLetterQueueEntry, DeadLetterQueueInsert } from '../schemas/deadLetterQueue.schema.js';
import type { SendMessageJobPayload } from '../types/message-queue.types.js';

interface DLQQueryOptions {
  page?: number;
  limit?: number;
  failureReason?: string;
}

interface DLQStatistics {
  total: number;
  byFailureReason: Record<string, number>;
  oldest: Date | null;
  newest: Date | null;
}

/**
 * Dead Letter Queue Service
 */
export class DLQService {
  /**
   * Move a failed message to the Dead Letter Queue
   *
   * Called after 3 failed retry attempts
   * Populates tracing fields for debugging and audit:
   * - correlationId: end-to-end request tracing
   * - ircProfileId: for IRC-specific DLQ queries
   * - externalThreadType: platform-specific thread type (channel vs DM)
   * - externalThreadId: the target thread identifier
   */
  async moveToDLQ(
    messageId: string,
    conversationId: string,
    payload: SendMessageJobPayload,
    failureReason: string,
    lastError: string
  ): Promise<DeadLetterQueueEntry> {
    try {
      // Calculate expiration date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Extract tracing fields from payload
      const correlationId = payload.correlationId || messageId; // Fallback to messageId if no correlation ID
      const ircProfileId = payload.platformType === 'irc' && payload.metadata?.ircProfileId
        ? Number(payload.metadata.ircProfileId)
        : null;
      const externalThreadId = payload.recipientId;
      // Determine thread type based on recipient format:
      // IRC channels start with # or &, DMs are usernames
      const externalThreadType =
        payload.platformType === 'irc'
          ? externalThreadId?.startsWith('#') || externalThreadId?.startsWith('&')
            ? 'channel'
            : 'dm'
          : 'unknown';

      const entry = await dbClient
        .insert(deadLetterQueue)
        .values({
          messageId,
          conversationId,
          payload: payload as unknown as Record<string, unknown>,
          failureReason,
          totalAttempts: payload.retryCount || 3,
          lastError,
          expiresAt,
          // INT-012: Populate tracing fields
          correlationId,
          ircProfileId,
          externalThreadType,
          externalThreadId,
        })
        .returning();

      logger.warn(
        {
          messageId,
          conversationId,
          failureReason,
          totalAttempts: payload.retryCount || 3,
          expiresAt,
          correlationId,
          ircProfileId,
          externalThreadType,
          externalThreadId,
        },
        'Message moved to Dead Letter Queue (INT-012: tracing fields populated)'
      );

      return entry[0];
    } catch (error) {
      logger.error(
        {
          messageId,
          conversationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to move message to DLQ'
      );
      throw error;
    }
  }

  /**
   * Get DLQ entries with pagination
   */
  async getDLQEntries(options: DLQQueryOptions = {}): Promise<{
    entries: DeadLetterQueueEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const offset = (page - 1) * limit;

    try {
      // Build where clauses
      const whereClauses = [];
      if (options.failureReason) {
        whereClauses.push(eq(deadLetterQueue.failureReason, options.failureReason));
      }

      const andCondition = whereClauses.length > 0 ? and(...whereClauses) : undefined;

      // Get total count
      const countResult = await dbClient
        .select({ count: count() })
        .from(deadLetterQueue)
        .where(andCondition);

      const total = countResult[0]?.count || 0;

      // Fetch paginated entries (most recent first)
      const entries = await dbClient
        .select()
        .from(deadLetterQueue)
        .where(andCondition)
        .orderBy(desc(deadLetterQueue.movedAt))
        .limit(limit)
        .offset(offset);

      logger.debug(
        {
          total,
          page,
          limit,
          count: entries.length,
        },
        'DLQ entries fetched'
      );

      return { entries, total, page, limit };
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to fetch DLQ entries'
      );
      throw error;
    }
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStatistics(): Promise<DLQStatistics> {
    try {
      // Get total count
      const totalResult = await dbClient
        .select({ count: count() })
        .from(deadLetterQueue);

      const total = totalResult[0]?.count || 0;

      // Get counts by failure reason
      const byReasonResult = await dbClient
        .select({
          failureReason: deadLetterQueue.failureReason,
          count: count(),
        })
        .from(deadLetterQueue)
        .groupBy(deadLetterQueue.failureReason);

      const byFailureReason: Record<string, number> = {};
      for (const row of byReasonResult) {
        byFailureReason[row.failureReason] = row.count;
      }

      // Get oldest and newest entries
      const oldestResult = await dbClient
        .select({ movedAt: deadLetterQueue.movedAt })
        .from(deadLetterQueue)
        .orderBy(deadLetterQueue.movedAt)
        .limit(1);

      const newestResult = await dbClient
        .select({ movedAt: deadLetterQueue.movedAt })
        .from(deadLetterQueue)
        .orderBy(desc(deadLetterQueue.movedAt))
        .limit(1);

      const stats: DLQStatistics = {
        total,
        byFailureReason,
        oldest: oldestResult[0]?.movedAt || null,
        newest: newestResult[0]?.movedAt || null,
      };

      logger.debug(stats, 'DLQ statistics calculated');

      return stats;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to get DLQ statistics'
      );
      throw error;
    }
  }

  /**
   * Get a single DLQ entry by ID
   */
  async getDLQEntry(id: string): Promise<DeadLetterQueueEntry | null> {
    try {
      const entry = await dbClient.query.deadLetterQueue.findFirst({
        where: eq(deadLetterQueue.id, id),
      });

      return entry || null;
    } catch (error) {
      logger.error(
        {
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to fetch DLQ entry'
      );
      throw error;
    }
  }

  /**
   * Mark a DLQ entry as re-queued (for manual retry)
   */
  async markAsRetried(id: string, retriedBy: string): Promise<DeadLetterQueueEntry> {
    try {
      const now = new Date();

      const updated = await dbClient
        .update(deadLetterQueue)
        .set({
          retryAttempt: true,
          retriedAt: now,
          retriedBy,
          updatedAt: now,
        })
        .where(eq(deadLetterQueue.id, id))
        .returning();

      logger.info(
        {
          id,
          retriedBy,
          retriedAt: now,
        },
        'DLQ entry marked as retried'
      );

      return updated[0];
    } catch (error) {
      logger.error(
        {
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to mark DLQ entry as retried'
      );
      throw error;
    }
  }

  /**
   * Remove a DLQ entry (after ops review)
   */
  async removeDLQEntry(id: string): Promise<boolean> {
    try {
      await dbClient.delete(deadLetterQueue).where(eq(deadLetterQueue.id, id));

      logger.info(
        {
          id,
        },
        'DLQ entry removed'
      );

      return true;
    } catch (error) {
      logger.error(
        {
          id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to remove DLQ entry'
      );
      throw error;
    }
  }

  /**
   * Clean up expired DLQ entries (older than 7 days)
   * Should be called periodically by a scheduled job
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      const now = new Date();

      const result = await dbClient
        .delete(deadLetterQueue)
        .where(lte(deadLetterQueue.expiresAt, now))
        .returning();

      if (result.length > 0) {
        logger.info(
          {
            deletedCount: result.length,
            now,
          },
          'Expired DLQ entries cleaned up'
        );
      }

      return result.length;
    } catch (error) {
      logger.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to cleanup expired DLQ entries'
      );
      throw error;
    }
  }

  /**
   * Get DLQ entries by conversation ID (for conversation audit trail)
   */
  async getDLQEntriesByConversation(conversationId: string): Promise<DeadLetterQueueEntry[]> {
    try {
      const entries = await dbClient
        .select()
        .from(deadLetterQueue)
        .where(eq(deadLetterQueue.conversationId, conversationId))
        .orderBy(desc(deadLetterQueue.movedAt));

      return entries;
    } catch (error) {
      logger.error(
        {
          conversationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to fetch DLQ entries by conversation'
      );
      throw error;
    }
  }
}

export const dlqService = new DLQService();
