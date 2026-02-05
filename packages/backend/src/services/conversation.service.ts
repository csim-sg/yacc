import { db } from '../../infrastructure/db/client';
import {
  conversations,
  messages,
  conversationTags,
  tags,
} from '../../infrastructure/db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { auditService } from './audit.service';

export interface ListConversationsParams {
  page?: number;
  limit?: number;
  channel?: string;
  status?: string;
  priority?: string;
  assignedUserId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  unread?: boolean;
  sortBy?: 'lastActivity' | 'created' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export class ConversationService {
  /**
   * List conversations with pagination and filters
   */
  async listConversations(params: ListConversationsParams) {
    const {
      page = 1,
      limit = 20,
      channel,
      status,
      priority,
      assignedUserId,
      search,
      dateFrom,
      dateTo,
      unread,
      sortBy = 'lastActivity',
      sortOrder = 'desc',
    } = params;

    const offset = (page - 1) * limit;

    // Build where clauses
    const whereClauses: SQL<unknown>[] = [];

    if (channel) {
      const channelValue = channel as (typeof conversations.channel.enumValues)[number];
      whereClauses.push(eq(conversations.channel, channelValue));
    }

    if (status) {
      const statusValue = status as (typeof conversations.status.enumValues)[number];
      whereClauses.push(eq(conversations.status, statusValue));
    }

    if (priority) {
      const priorityValue = priority as (typeof conversations.priority.enumValues)[number];
      whereClauses.push(eq(conversations.priority, priorityValue));
    }

    if (assignedUserId) {
      whereClauses.push(eq(conversations.assignedUserId, assignedUserId));
    }

    if (search) {
      const like = `%${search}%`;
      whereClauses.push(
        sql`(
          ${conversations.title} ILIKE ${like}
          OR ${conversations.externalThreadId} ILIKE ${like}
          OR EXISTS (
            SELECT 1 FROM ${messages}
            WHERE ${messages.conversationId} = ${conversations.id}
              AND (${messages.body} ILIKE ${like} OR ${messages.senderName} ILIKE ${like})
          )
        )`
      );
    }

    if (dateFrom) {
      whereClauses.push(sql`${conversations.lastActivityAt} >= ${new Date(dateFrom)}`);
    }

    if (dateTo) {
      whereClauses.push(sql`${conversations.lastActivityAt} <= ${new Date(dateTo)}`);
    }

    if (unread === true) {
      whereClauses.push(
        sql`EXISTS (
          SELECT 1 FROM ${messages}
          WHERE ${messages.conversationId} = ${conversations.id}
            AND ${messages.direction} = 'inbound'
        )`
      );
    }

    // Build sort
    let orderBy;
    if (sortBy === 'created') {
      orderBy =
        sortOrder === 'desc'
          ? desc(conversations.createdAt)
          : asc(conversations.createdAt);
    } else if (sortBy === 'priority') {
      orderBy = desc(conversations.priority);
    } else {
      // lastActivity (default)
      orderBy =
        sortOrder === 'desc'
          ? desc(conversations.lastActivityAt)
          : asc(conversations.lastActivityAt);
    }

    // Get total count
    const countResult = whereClauses.length > 0
      ? await db
          .select({ count: sql<number>`count(*)` })
          .from(conversations)
          .where(and(...whereClauses))
      : await db
          .select({ count: sql<number>`count(*)` })
          .from(conversations);
    const total = countResult[0]?.count || 0;

    // Get conversations
    const convos = whereClauses.length > 0
      ? await db
          .select()
          .from(conversations)
          .where(and(...whereClauses))
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset)
      : await db
          .select()
          .from(conversations)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset);

    // For each conversation, get latest message, tags, and unread count
    const enrichedConvos = await Promise.all(
      convos.map(async (convo) => {
        const latestMessage = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, convo.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const convoTags = await db
          .select({
            id: tags.id,
            name: tags.name,
            color: tags.color,
          })
          .from(conversationTags)
          .innerJoin(tags, eq(tags.id, conversationTags.tagId))
          .where(eq(conversationTags.conversationId, convo.id));

        // Count unread messages (for Phase 1, we'll count all inbound messages as "unread")
        // In Phase 2, we'll add a proper read/unread tracking system
        const unreadCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, convo.id),
              eq(messages.direction, 'inbound')
            )
          );

        return {
          ...convo,
          latestMessage: latestMessage[0] || null,
          tags: convoTags,
          unreadCount: unreadCount[0]?.count || 0,
        };
      })
    );

    return {
      conversations: enrichedConvos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single conversation by ID
   */
  async getConversation(id: string) {
    const convo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    if (!convo.length) {
      throw new Error('Conversation not found');
    }

    // Get all messages
    const convMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    // Get tags
    const convoTags = await db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(conversationTags)
      .innerJoin(tags, eq(tags.id, conversationTags.tagId))
      .where(eq(conversationTags.conversationId, id));

    return {
      ...convo[0],
      messages: convMessages,
      tags: convoTags,
    };
  }

  /**
   * Create a message and auto-reopen resolved conversations on inbound
   */
  async createMessage(params: {
    conversationId: string;
    senderName: string;
    body: string;
    direction: 'inbound' | 'outbound';
    status?: 'pending' | 'sent' | 'failed';
  }) {
    const { conversationId, senderName, body, direction, status = 'sent' } = params;
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const now = new Date();
    let reopened = false;

    if (direction === 'inbound' && conversation.status === 'resolved') {
      await db
        .update(conversations)
        .set({ status: 'open', updatedAt: now })
        .where(eq(conversations.id, conversationId));

      await auditService.logAction({
        action: 'conversation_reopened',
        entityType: 'conversation',
        entityId: conversationId,
        metadata: {
          reason: 'inbound_message',
          oldStatus: 'resolved',
          newStatus: 'open',
        },
      });

      reopened = true;
    }

    const [message] = await db
      .insert(messages)
      .values({
        conversationId,
        senderName,
        body,
        direction,
        status,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db
      .update(conversations)
      .set({ lastActivityAt: now, updatedAt: now, status: reopened ? 'open' : conversation.status })
      .where(eq(conversations.id, conversationId));

    return { message, reopened };
  }

  /**
   * Update conversation status
   */
  async updateConversationStatus(
    id: string,
    status: 'open' | 'pending' | 'resolved'
  ) {
    const result = await db
      .update(conversations)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id))
      .returning();

    if (!result.length) {
      throw new Error('Conversation not found');
    }

    return result[0];
  }

  /**
   * Update status (alias for controller)
   */
  async updateStatus(id: string, status: 'open' | 'pending' | 'resolved') {
    const oldConvo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    const conversation = await this.updateConversationStatus(id, status);

    return {
      conversation,
      oldStatus: oldConvo[0]?.status,
    };
  }

  /**
   * Update conversation priority
   */
  async updateConversationPriority(
    id: string,
    priority: 'low' | 'medium' | 'high' | 'urgent'
  ) {
    const result = await db
      .update(conversations)
      .set({
        priority,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id))
      .returning();

    if (!result.length) {
      throw new Error('Conversation not found');
    }

    return result[0];
  }

  /**
   * Update priority (alias for controller)
   */
  async updatePriority(id: string, priority: 'low' | 'medium' | 'high' | 'urgent') {
    const oldConvo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    const conversation = await this.updateConversationPriority(id, priority);

    return {
      conversation,
      oldPriority: oldConvo[0]?.priority,
    };
  }

  /**
   * Update conversation assignment
   */
  async updateConversationAssignment(id: string, assignedUserId: string | null) {
    const result = await db
      .update(conversations)
      .set({
        assignedUserId,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, id))
      .returning();

    if (!result.length) {
      throw new Error('Conversation not found');
    }

    return result[0];
  }

  /**
   * Assign conversation (alias for controller)
   */
  async assignConversation(id: string, assignedUserId: string | null) {
    const oldConvo = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    const conversation = await this.updateConversationAssignment(id, assignedUserId);

    return {
      conversation,
      oldAssignedUserId: oldConvo[0]?.assignedUserId,
    };
  }

  /**
   * Add tag to conversation
   */
  async addTagToConversation(conversationId: string, tagId: number) {
    // Check if already tagged
    const existing = await db
      .select()
      .from(conversationTags)
      .where(
        and(
          eq(conversationTags.conversationId, conversationId),
          eq(conversationTags.tagId, tagId)
        )
      );

    if (existing.length > 0) {
      return { success: true, message: 'Tag already applied' };
    }

    await db.insert(conversationTags).values({
      conversationId,
      tagId,
    });

    return { success: true, message: 'Tag added' };
  }

  /**
   * Add tag (alias for controller)
   */
  async addTag(conversationId: string, tagId: number) {
    return await this.addTagToConversation(conversationId, tagId);
  }

  /**
   * Remove tag from conversation
   */
  async removeTagFromConversation(conversationId: string, tagId: number) {
    await db
      .delete(conversationTags)
      .where(
        and(
          eq(conversationTags.conversationId, conversationId),
          eq(conversationTags.tagId, tagId)
        )
      );

    return { success: true, message: 'Tag removed' };
  }

  /**
   * Remove tag (alias for controller)
   */
  async removeTag(conversationId: string, tagId: number) {
    return await this.removeTagFromConversation(conversationId, tagId);
  }
}

export const conversationService = new ConversationService();
