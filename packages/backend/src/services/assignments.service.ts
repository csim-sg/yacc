/**
 * Assignments Service
 * Handles conversation assignment operations and notifications
 */

import { eq } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { conversations } from '../schemas/conversation.schema';
import { notifications } from '../schemas/notification.schema';
import { users } from '../schemas/user.schema';
import { auditService } from './audit.service';
import type { AssignmentResponse } from '../types/assignments.types';

export class AssignmentsService {
  /**
   * Assign a conversation to a user
   * Creates notification for the assignee and logs audit event
   */
  async assignConversation(
    conversationId: string,
    newAssignedUserId: string,
    actorId: string
  ): Promise<AssignmentResponse> {
    try {
      // Verify conversation exists
      const conversation = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error('Conversation not found');
      }

      const previouslyAssignedUserId = conversation[0].assignedUserId;

      // Verify assigned user exists
      const assignedUser = await dbClient
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, newAssignedUserId))
        .limit(1);

      if (assignedUser.length === 0) {
        throw new Error('User not found');
      }

      // Update conversation with new assignment
      const result = await dbClient
        .update(conversations)
        .set({
          assignedUserId: newAssignedUserId,
          updatedAt: new Date(),
          lastActivityAt: new Date(),
        })
        .where(eq(conversations.id, conversationId))
        .returning();

      if (result.length === 0) {
        throw new Error('Failed to update conversation assignment');
      }

      const updatedConversation = result[0];

      // Create notification for the new assignee (deduped on user_id + conversation_id + type)
      try {
        await dbClient
          .insert(notifications)
          .values({
            userId: newAssignedUserId,
            type: 'assignment',
            conversationId,
            actorId,
            message: 'You have been assigned to a conversation',
          })
          .onConflictDoNothing();
      } catch (notificationError: unknown) {
        // Log notification creation errors but don't fail the assignment
        const notifMsg = notificationError instanceof Error ? notificationError.message : 'Unknown error';
        logger.warn(
          { newAssignedUserId, conversationId, error: notifMsg },
          'Failed to create assignment notification'
        );
      }

      // Log audit event with old and new values
      const auditMetadata: Record<string, unknown> = {
        oldAssignedUserId: previouslyAssignedUserId,
        newAssignedUserId,
        conversationId,
      };

      await auditService.logAction({
        actorId,
        action: 'conversation.assigned',
        entityType: 'conversation',
        entityId: conversationId,
        metadata: auditMetadata,
      });

      logger.info(
        {
          conversationId,
          previouslyAssignedUserId,
          newAssignedUserId,
          actorId,
        },
        'Conversation assigned successfully'
      );

      return {
        id: updatedConversation.id,
        conversationId,
        previouslyAssignedUserId,
        newlyAssignedUserId: newAssignedUserId,
        assignedAt: updatedConversation.updatedAt.toISOString(),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        {
          conversationId,
          newAssignedUserId,
          actorId,
          error: message,
        },
        'Failed to assign conversation'
      );
      throw error;
    }
  }

  /**
   * Get current assignment for a conversation
   */
  async getAssignment(conversationId: string): Promise<string | null> {
    try {
      const conversation = await dbClient
        .select({ assignedUserId: conversations.assignedUserId })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error('Conversation not found');
      }

      return conversation[0].assignedUserId;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ conversationId, error: message }, 'Failed to get assignment');
      throw error;
    }
  }
}

export const assignmentsService = new AssignmentsService();
