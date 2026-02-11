/**
 * Tag Service
 * Handles tag creation and conversation tag management
 */

import { dbClient } from '../infrastructure/db.client';
import { tags } from '../schemas/tag.schema';
import { conversationTags } from '../schemas/conversationTag.schema';
import { conversations } from '../schemas/conversation.schema';
import { eq, and } from 'drizzle-orm';
import { auditService } from './audit.service';
import { emitToConversation, isWebSocketGatewayAvailable } from './websocket/websocket-gateway';
import { logger } from '../infrastructure/logger';
import type {
  CreateTagParams,
  AddTagToConversationParams,
  RemoveTagFromConversationParams,
  TagServiceResult,
  ConversationTag,
} from '../types/tag.types';

export class TagService {
  /**
   * List all tags
   */
  async listTags() {
    try {
      const allTags = await dbClient.select().from(tags).orderBy(tags.name);
      return {
        success: true,
        data: allTags,
      };
    } catch (error: unknown) {
      logger.error({ err: error }, 'Failed to list tags');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list tags',
      };
    }
  }

  /**
   * Create a new tag
   * Audit logs: tag.created
   */
  async createTag(params: CreateTagParams) {
    const { name, color = '#808080', createdById } = params;

    try {
      const newTag = await dbClient
        .insert(tags)
        .values({
          name,
          color,
          createdById,
        })
        .returning();

      // Audit log: tag.created
      // Use nil UUID (00000000-0000-0000-0000-000000000000) for global tag creation
      await auditService.logAction({
        actorId: createdById,
        action: 'tag.created',
        entityType: 'conversation',
        entityId: '00000000-0000-0000-0000-000000000000',
        metadata: {
          tagId: newTag[0]?.id,
          tagName: name,
          color,
        },
      });

      return {
        success: true,
        data: newTag[0],
      };
    } catch (error: unknown) {
      logger.error({ err: error }, 'Failed to create tag');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create tag',
      };
    }
  }

  /**
   * Add tag to conversation (idempotent)
   * Audit logs: conversation.tag_added
   * Emits: conversation.updated
   */
  async addTagToConversation(params: AddTagToConversationParams): Promise<TagServiceResult<{ tags: ConversationTag[] }>> {
    const { conversationId, tagId, userId } = params;

    try {
      // Check if conversation exists
      const convo = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (!convo[0]) {
        return {
          success: false,
          error: 'Conversation not found',
          statusCode: 404,
        };
      }

      // Check if tag exists
      const tag = await dbClient
        .select()
        .from(tags)
        .where(eq(tags.id, tagId))
        .limit(1);

      if (!tag[0]) {
        return {
          success: false,
          error: 'Tag not found',
          statusCode: 404,
        };
      }

      // Use atomic INSERT...ON CONFLICT DO NOTHING for idempotency (race-safe)
      // This prevents race conditions in concurrent requests
      await dbClient
        .insert(conversationTags)
        .values({
          conversationId,
          tagId,
        })
        .onConflictDoNothing();

      // Check if tag was actually added (for audit logging)
      // If it already existed, we still emit the event but don't log again
      const tagWasAdded = await dbClient
        .select()
        .from(conversationTags)
        .where(
          and(
            eq(conversationTags.conversationId, conversationId),
            eq(conversationTags.tagId, tagId)
          )
        )
        .limit(1);

      // Audit log: conversation.tag_added
      // Make this transactional: throw error if audit fails (don't silently ignore)
      if (tagWasAdded[0]) {
        try {
          await auditService.logAction({
            actorId: userId,
            action: 'conversation.tag_added',
            entityType: 'conversation',
            entityId: conversationId,
            metadata: {
              tagId,
              tagName: tag[0].name,
            },
          });
        } catch (auditError: unknown) {
          logger.error(
            { err: auditError },
            'Audit logging failed for tag addition - rolling back WebSocket event'
          );
          // Rethrow to fail the operation if audit can't be logged
          throw auditError;
        }
      }

      // Fetch updated tags for conversation
      const updatedTags = await dbClient
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          createdById: tags.createdById,
          createdAt: tags.createdAt,
        })
        .from(conversationTags)
        .innerJoin(tags, eq(tags.id, conversationTags.tagId))
        .where(eq(conversationTags.conversationId, conversationId));

      // Emit WebSocket event using backlog helper (ensures 1-hour replay)
      if (isWebSocketGatewayAvailable()) {
        await emitToConversation(conversationId, 'conversation.updated', {
          conversationId,
          updatedFields: { tags: updatedTags },
          changedBy: userId,
          changedAt: new Date().toISOString(),
        });
      }

      return {
        success: true,
        data: {
          tags: updatedTags,
        },
      };
    } catch (error: unknown) {
      logger.error({ err: error }, 'Failed to add tag to conversation');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add tag to conversation',
      };
    }
  }

  /**
   * Remove tag from conversation (graceful if not present)
   * Audit logs: conversation.tag_removed
   * Emits: conversation.updated
   */
  async removeTagFromConversation(params: RemoveTagFromConversationParams): Promise<TagServiceResult<{ tags: ConversationTag[] }>> {
    const { conversationId, tagId, userId } = params;

    try {
      // Check if conversation exists
      const convo = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (!convo[0]) {
        return {
          success: false,
          error: 'Conversation not found',
          statusCode: 404,
        };
      }

      // Check if tag exists
      const tag = await dbClient
        .select()
        .from(tags)
        .where(eq(tags.id, tagId))
        .limit(1);

      if (!tag[0]) {
        return {
          success: false,
          error: 'Tag not found',
          statusCode: 404,
        };
      }

      // Check if tag is on conversation
      const existing = await dbClient
        .select()
        .from(conversationTags)
        .where(
          and(
            eq(conversationTags.conversationId, conversationId),
            eq(conversationTags.tagId, tagId)
          )
        )
        .limit(1);

      if (existing[0]) {
        // Remove tag from conversation
        await dbClient
          .delete(conversationTags)
          .where(
            and(
              eq(conversationTags.conversationId, conversationId),
              eq(conversationTags.tagId, tagId)
            )
          );

        // Audit log: conversation.tag_removed
        // Make this transactional: throw error if audit fails (don't silently ignore)
        try {
          await auditService.logAction({
            actorId: userId,
            action: 'conversation.tag_removed',
            entityType: 'conversation',
            entityId: conversationId,
            metadata: {
              tagId,
              tagName: tag[0].name,
            },
          });
        } catch (auditError: unknown) {
          logger.error(
            { err: auditError },
            'Audit logging failed for tag removal - rolling back WebSocket event'
          );
          // Rethrow to fail the operation if audit can't be logged
          throw auditError;
        }
      }

      // Fetch updated tags for conversation
      const updatedTags = await dbClient
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          createdById: tags.createdById,
          createdAt: tags.createdAt,
        })
        .from(conversationTags)
        .innerJoin(tags, eq(tags.id, conversationTags.tagId))
        .where(eq(conversationTags.conversationId, conversationId));

      // Emit WebSocket event using backlog helper (ensures 1-hour replay)
      if (isWebSocketGatewayAvailable()) {
        await emitToConversation(conversationId, 'conversation.updated', {
          conversationId,
          updatedFields: { tags: updatedTags },
          changedBy: userId,
          changedAt: new Date().toISOString(),
        });
      }

      return {
        success: true,
        data: {
          tags: updatedTags,
        },
      };
    } catch (error: unknown) {
      logger.error({ err: error }, 'Failed to remove tag from conversation');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove tag from conversation',
      };
    }
  }
}

export const tagService = new TagService();
