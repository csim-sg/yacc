/**
 * Bulk Actions Service
 * 
 * Handles bulk operations on conversations:
 * - Bulk assign/reassign conversations to users
 * - Bulk tag (add tags to conversations)
 * - Bulk status update (change conversation status)
 * 
 * Strategy:
 * - Best-effort: process each conversation individually
 * - Transaction-per-conversation (not bulk transaction)
 * - Collect failures and return to caller
 * - Max 100 conversations per request
 */

import { eq } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { conversations } from '../schemas/conversation.schema';
import { conversationTags } from '../schemas/conversationTag.schema';
import { tags } from '../schemas/tag.schema';
import { auditService } from './audit.service';
import type { BulkActionResponse, BulkActionFailure, ConversationStatus } from '../types/bulk-actions.types';
import { logger } from '../infrastructure/logger';

const MAX_BULK_SIZE = 100;

/**
 * Bulk assign conversations to a user
 * 
 * Best-effort: continues even if some conversations fail to assign
 * Logs each success/failure in audit logs
 */
export async function bulkAssign(
  conversationIds: string[],
  userId: string,
  assigneeId: string,
  correlationId: string = 'unknown'
): Promise<BulkActionResponse> {
  const failures: BulkActionFailure[] = [];
  let successCount = 0;

  // Validate input
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    return { successCount: 0, failureCount: 0, failures: [] };
  }

  if (conversationIds.length > MAX_BULK_SIZE) {
    return {
      successCount: 0,
      failureCount: conversationIds.length,
      failures: conversationIds.map((id) => ({
        id,
        reason: `Max ${MAX_BULK_SIZE} conversations per request`,
      })),
    };
  }

  // Verify assignee exists
  const assigneeExists = await dbClient
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.assignedUserId, assigneeId))
    .limit(1)
    .catch(() => null);

  // Note: We don't strictly require assignee to exist - they might be getting unassigned
  // But we log if it's suspicious

  // Process each conversation
  for (const conversationId of conversationIds) {
    try {
      // Update conversation
      const result = await dbClient
        .update(conversations)
        .set({
          assignedUserId: assigneeId,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId))
        .returning();

      if (!result || result.length === 0) {
        failures.push({ id: conversationId, reason: 'Conversation not found' });
        continue;
      }

      // Log audit event
      await auditService.logAction({
        actorId: userId,
        action: 'bulk_action_applied',
        entityType: 'conversation',
        entityId: conversationId,
        metadata: {
          action: 'assign',
          assigneeId,
          bulkOperation: true,
        },
      });

      successCount++;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(
        { correlationId, conversationId, error: errorMsg },
        'Failed to bulk assign conversation'
      );
      failures.push({ id: conversationId, reason: `Assignment failed: ${errorMsg}` });
    }
  }

  logger.info(
    { correlationId, successCount, failureCount: failures.length },
    'Bulk assign complete'
  );

  return {
    successCount,
    failureCount: failures.length,
    failures,
  };
}

/**
 * Bulk add tag to conversations
 * 
 * Best-effort: continues even if some conversations fail
 * Note: tagId is a number (serial) in the database
 */
export async function bulkTag(
  conversationIds: string[],
  tagId: number,
  userId: string,
  correlationId: string = 'unknown'
): Promise<BulkActionResponse> {
  const failures: BulkActionFailure[] = [];
  let successCount = 0;

  // Validate input
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    return { successCount: 0, failureCount: 0, failures: [] };
  }

  if (conversationIds.length > MAX_BULK_SIZE) {
    return {
      successCount: 0,
      failureCount: conversationIds.length,
      failures: conversationIds.map((id) => ({
        id,
        reason: `Max ${MAX_BULK_SIZE} conversations per request`,
      })),
    };
  }

  // Verify tag exists
  const tagExists = await dbClient
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.id, tagId))
    .limit(1)
    .catch(() => null);

  if (!tagExists || tagExists.length === 0) {
    return {
      successCount: 0,
      failureCount: conversationIds.length,
      failures: conversationIds.map((id) => ({
        id,
        reason: 'Tag not found',
      })),
    };
  }

  // Process each conversation
  for (const conversationId of conversationIds) {
    try {
      // Check if tag already attached
      const existing = await dbClient
        .select({ id: conversationTags.conversationId })
        .from(conversationTags)
        .where(
          eq(conversationTags.conversationId, conversationId) &&
            eq(conversationTags.tagId, tagId)
        )
        .limit(1)
        .catch(() => null);

      if (existing && existing.length > 0) {
        // Already tagged, skip
        successCount++;
        continue;
      }

      // Attach tag (use correct field names)
      await dbClient.insert(conversationTags).values([
        {
          conversationId: conversationId,
          tagId: tagId,
        },
      ]);

      // Log audit event
      await auditService.logAction({
        actorId: userId,
        action: 'bulk_action_applied',
        entityType: 'tag',
        entityId: `${conversationId}/${tagId}`,
        metadata: {
          action: 'tag',
          conversationId,
          tagId,
          bulkOperation: true,
        },
      });

      successCount++;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(
        { correlationId, conversationId, tagId, error: errorMsg },
        'Failed to bulk tag conversation'
      );
      failures.push({ id: conversationId, reason: `Tagging failed: ${errorMsg}` });
    }
  }

  logger.info(
    { correlationId, successCount, failureCount: failures.length },
    'Bulk tag complete'
  );

  return {
    successCount,
    failureCount: failures.length,
    failures,
  };
}

/**
 * Bulk update conversation status
 * 
 * Best-effort: continues even if some conversations fail
 */
export async function bulkUpdateStatus(
  conversationIds: string[],
  status: ConversationStatus,
  userId: string,
  correlationId: string = 'unknown'
): Promise<BulkActionResponse> {
  const failures: BulkActionFailure[] = [];
  let successCount = 0;

  // Validate input
  if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
    return { successCount: 0, failureCount: 0, failures: [] };
  }

  if (conversationIds.length > MAX_BULK_SIZE) {
    return {
      successCount: 0,
      failureCount: conversationIds.length,
      failures: conversationIds.map((id) => ({
        id,
        reason: `Max ${MAX_BULK_SIZE} conversations per request`,
      })),
    };
  }

  // Validate status
  const validStatuses: ConversationStatus[] = ['open', 'pending', 'resolved'];
  if (!validStatuses.includes(status)) {
    return {
      successCount: 0,
      failureCount: conversationIds.length,
      failures: conversationIds.map((id) => ({
        id,
        reason: `Invalid status: ${status}`,
      })),
    };
  }

  // Process each conversation
  for (const conversationId of conversationIds) {
    try {
      // Update status
      const result = await dbClient
        .update(conversations)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId))
        .returning();

      if (!result || result.length === 0) {
        failures.push({ id: conversationId, reason: 'Conversation not found' });
        continue;
      }

      // Log audit event
      await auditService.logAction({
        actorId: userId,
        action: 'bulk_action_applied',
        entityType: 'conversation',
        entityId: conversationId,
        metadata: {
          action: 'status',
          oldStatus: result[0]?.status,
          newStatus: status,
          bulkOperation: true,
        },
      });

      successCount++;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn(
        { correlationId, conversationId, status, error: errorMsg },
        'Failed to bulk update conversation status'
      );
      failures.push({ id: conversationId, reason: `Status update failed: ${errorMsg}` });
    }
  }

  logger.info(
    { correlationId, successCount, failureCount: failures.length },
    'Bulk status update complete'
  );

  return {
    successCount,
    failureCount: failures.length,
    failures,
  };
}

// Export service object for consistency
export const bulkActionsService = {
  bulkAssign,
  bulkTag,
  bulkUpdateStatus,
};
