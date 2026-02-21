import { eq, and } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { logger } from '../infrastructure/logger';
import { conversations } from '../schemas/conversation.schema';
import { conversationTags } from '../schemas/conversationTag.schema';
import { tags } from '../schemas/tag.schema';
import type { CreateTagRequest, AttachTagRequest } from '../types/tags.types';
import { auditService } from './audit.service';

interface LogTagAuditParams {
  actorId: string;
  action: string;
  conversationId?: string;
  tagId?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Tags Service
 * Handles tag creation, listing, and tag-conversation associations
 */
export class TagsService {
  /**
   * Create a new tag
   */
  async createTag(createdById: string, request: CreateTagRequest) {
    const { name, color = '#808080' } = request;

    try {
      // Validate input
      if (!name || name.trim().length === 0) {
        throw new Error('Tag name is required');
      }

      if (name.trim().length > 255) {
        throw new Error('Tag name must be 255 characters or less');
      }

      // Create tag with unique constraint on (name, created_by_id)
      const result = await dbClient
        .insert(tags)
        .values({
          name: name.trim(),
          color,
          createdById,
        })
        .returning();

      const createdTag = result[0];

      // Log audit event
      await this.logAudit({
        actorId: createdById,
        action: 'tag.created',
        tagId: createdTag.id,
        metadata: {
          tagName: createdTag.name,
          tagColor: createdTag.color,
        },
      });

      logger.info(
        { tagId: createdTag.id, userId: createdById, tagName: createdTag.name },
        'Tag created successfully'
      );

      return createdTag;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId: createdById, tagName: request.name },
        'Failed to create tag'
      );
      throw error;
    }
  }

  /**
   * List all tags for the current user
   */
  async listTags(userId: string) {
    try {
      // Get all tags created by this user
      const userTags = await dbClient
        .select()
        .from(tags)
        .where(eq(tags.createdById, userId))
        .orderBy(tags.name);

      logger.info(
        { userId, count: userTags.length },
        'Tags listed successfully'
      );

      return userTags;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId },
        'Failed to list tags'
      );
      throw error;
    }
  }

  /**
   * Attach a tag to a conversation
   */
  async attachTagToConversation(
    userId: string,
    conversationId: string,
    request: AttachTagRequest
  ) {
    const { tagId } = request;

    try {
      // Validate conversation exists
      const conversation = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error('Conversation not found');
      }

      // Check if tag already attached
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

      if (existing.length > 0) {
        // Tag already attached, return conversation tags
        return await this.getConversationTags(conversationId);
      }

      // Attach tag
      await dbClient.insert(conversationTags).values({
        conversationId,
        tagId,
      });

      // Log audit event
      const tag = await dbClient
        .select()
        .from(tags)
        .where(eq(tags.id, tagId))
        .limit(1);

      await this.logAudit({
        actorId: userId,
        action: 'conversation.tag_added',
        conversationId,
        tagId,
        metadata: {
          tagName: tag[0]?.name || 'Unknown',
        },
      });

      logger.info(
        { conversationId, tagId, userId },
        'Tag attached to conversation'
      );

      // Return updated conversation tags
      return await this.getConversationTags(conversationId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId, conversationId, tagId },
        'Failed to attach tag to conversation'
      );
      throw error;
    }
  }

  /**
   * Detach a tag from a conversation
   */
  async detachTagFromConversation(
    userId: string,
    conversationId: string,
    tagId: number
  ) {
    try {
      // Validate conversation exists
      const conversation = await dbClient
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error('Conversation not found');
      }

      // Check if tag is attached
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

      if (existing.length === 0) {
        // Tag not attached, return conversation tags anyway
        return await this.getConversationTags(conversationId);
      }

      // Detach tag
      await dbClient
        .delete(conversationTags)
        .where(
          and(
            eq(conversationTags.conversationId, conversationId),
            eq(conversationTags.tagId, tagId)
          )
        );

      // Log audit event
      const tag = await dbClient
        .select()
        .from(tags)
        .where(eq(tags.id, tagId))
        .limit(1);

      await this.logAudit({
        actorId: userId,
        action: 'conversation.tag_removed',
        conversationId,
        tagId,
        metadata: {
          tagName: tag[0]?.name || 'Unknown',
        },
      });

      logger.info(
        { conversationId, tagId, userId },
        'Tag detached from conversation'
      );

      // Return updated conversation tags
      return await this.getConversationTags(conversationId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, userId, conversationId, tagId },
        'Failed to detach tag from conversation'
      );
      throw error;
    }
  }

  /**
   * Get all tags for a conversation
   */
  async getConversationTags(conversationId: string) {
    try {
      // Get all tags for this conversation via junction table with join
      const tagList = await dbClient
        .select({ tag: tags })
        .from(conversationTags)
        .innerJoin(tags, eq(conversationTags.tagId, tags.id))
        .where(eq(conversationTags.conversationId, conversationId))
        .orderBy(tags.name);

      return tagList.map((item) => item.tag);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { error: message, conversationId },
        'Failed to get conversation tags'
      );
      throw error;
    }
  }

  /**
   * Log audit event for tag operations
   * Note: Audit logs use 'conversation' as entityType for conversation-scoped operations
   */
  private async logAudit(params: LogTagAuditParams) {
    const { actorId, action, conversationId, metadata } = params;

    try {
      // Only log conversation-scoped operations (when conversationId is provided)
      if (conversationId) {
        await auditService.logAction({
          actorId,
          action,
          entityType: 'conversation',
          entityId: conversationId,
          metadata,
        });
      }
      // Tag creation is logged but not conversation-scoped (future: multi-entity audit)
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.warn(
        { error: errorMsg, action },
        'Failed to log audit event'
      );
      // Don't throw - audit failures shouldn't break application
    }
  }
}

export const tagsService = new TagsService();
