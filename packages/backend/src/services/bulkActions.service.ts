/**
 * Bulk Actions Service
 * 
 * Handles bulk operations on conversations:
 * - Bulk assign/reassign conversations to users
 * - Bulk tag (add tags to conversations)
 * - Bulk status update (change conversation status)
 * 
 * Strategy:
 * - Best-effort: process each conversation independently
 * - Atomic per-conversation (partial success acceptable)
 * - Collect failures with safe error messages
 * - Max 100 conversations per request
 * - Never expose internal DB errors to clients
 */

import { eq, and } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { conversations } from '../schemas/conversation.schema';
import { conversationTags } from '../schemas/conversationTag.schema';
import { tags } from '../schemas/tag.schema';
import type { BulkActionResponse, BulkActionFailure, ConversationStatus } from '../types/bulkActions.types';
import { auditService } from './audit.service';

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
  assigneeId: string | null,
  correlationId: string = 'unknown'
): Promise<BulkActionResponse> {
   const failures: BulkActionFailure[] = [];
   let successCount = 0;

   // Validate input
   if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
     return { data: { successCount: 0, failureCount: 0, failures: [] } };
   }

   if (conversationIds.length > MAX_BULK_SIZE) {
     return {
       data: {
         successCount: 0,
         failureCount: conversationIds.length,
         failures: conversationIds.map((id) => ({
           id,
           reason: `Max ${MAX_BULK_SIZE} conversations per request`,
         })),
       },
     };
    }

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
       // Check if it's a FK constraint error (assignee doesn't exist)
       const errorMsg = error instanceof Error ? error.message : String(error);
       const isForeignKeyError = errorMsg.includes('foreign key') || errorMsg.includes('violates');
       const reason = isForeignKeyError ? 'Assignee user not found' : 'Conversation not found';
       
       logger.warn(
         { correlationId, conversationId, error: errorMsg },
         'Failed to bulk assign conversation'
       );
       failures.push({ id: conversationId, reason });
     }
   }

   logger.info(
     { correlationId, successCount, failureCount: failures.length },
     'Bulk assign complete'
   );

   return {
     data: {
       successCount,
       failureCount: failures.length,
       failures,
     },
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
     return { data: { successCount: 0, failureCount: 0, failures: [] } };
   }

   if (conversationIds.length > MAX_BULK_SIZE) {
     return {
       data: {
         successCount: 0,
         failureCount: conversationIds.length,
         failures: conversationIds.map((id) => ({
           id,
           reason: `Max ${MAX_BULK_SIZE} conversations per request`,
         })),
       },
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
       data: {
         successCount: 0,
         failureCount: conversationIds.length,
         failures: conversationIds.map((id) => ({
           id,
           reason: 'Tag not found',
         })),
       },
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
          and(
            eq(conversationTags.conversationId, conversationId),
            eq(conversationTags.tagId, tagId)
          )
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

       // Log audit event (entityId must be conversation UUID for cross-entity queries to work)
       await auditService.logAction({
         actorId: userId,
         action: 'bulk_action_applied',
         entityType: 'conversation',
         entityId: conversationId,
         metadata: {
           action: 'tag',
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
      // Use safe error message (don't expose DB internals)
      const safeReason = errorMsg.includes('not found') ? 'Tag not found' : 'Tagging operation failed';
      failures.push({ id: conversationId, reason: safeReason });
    }
  }

   logger.info(
     { correlationId, successCount, failureCount: failures.length },
     'Bulk tag complete'
   );

   return {
     data: {
       successCount,
       failureCount: failures.length,
       failures,
     },
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
     return { data: { successCount: 0, failureCount: 0, failures: [] } };
   }

   if (conversationIds.length > MAX_BULK_SIZE) {
     return {
       data: {
         successCount: 0,
         failureCount: conversationIds.length,
         failures: conversationIds.map((id) => ({
           id,
           reason: `Max ${MAX_BULK_SIZE} conversations per request`,
         })),
       },
     };
   }

   // Validate status
   const validStatuses: ConversationStatus[] = ['open', 'pending', 'resolved'];
   if (!validStatuses.includes(status)) {
     return {
       data: {
         successCount: 0,
         failureCount: conversationIds.length,
         failures: conversationIds.map((id) => ({
           id,
           reason: `Invalid status: ${status}`,
         })),
       },
     };
   }

   // Process each conversation
   for (const conversationId of conversationIds) {
     try {
       // Get old status before update
       const current = await dbClient
         .select({ status: conversations.status })
         .from(conversations)
         .where(eq(conversations.id, conversationId))
         .limit(1);

       if (!current || current.length === 0) {
         failures.push({ id: conversationId, reason: 'Conversation not found' });
         continue;
       }

       const oldStatus = current[0].status;

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

       // Log audit event with old status captured before update
       await auditService.logAction({
         actorId: userId,
         action: 'bulk_action_applied',
         entityType: 'conversation',
         entityId: conversationId,
         metadata: {
           action: 'status',
           oldStatus,
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
      // Use safe error message (don't expose DB internals)
      const safeReason = 'Status update failed';
      failures.push({ id: conversationId, reason: safeReason });
    }
  }

   logger.info(
     { correlationId, successCount, failureCount: failures.length },
     'Bulk status update complete'
   );

   return {
     data: {
       successCount,
       failureCount: failures.length,
       failures,
     },
   };
 }
 
 // Export service object for consistency
 export const bulkActionsService = {
   bulkAssign,
   bulkTag,
   bulkUpdateStatus,
 };
