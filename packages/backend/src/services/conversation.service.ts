import { eq, and, desc, asc, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client';
import { conversations } from '../schemas/conversation.schema';
import { conversationTags } from '../schemas/conversationTag.schema';
import { messages } from '../schemas/message.schema';
import { tags } from '../schemas/tag.schema';
import { users } from '../schemas/user.schema';
import { auditService } from './audit.service';

export interface ListConversationsParams {
  page?: number;
  limit?: number;
  channel?: string;
  status?: string;
  priority?: string;
  assignedUserId?: string;
  tagId?: number;
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
      tagId,
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

    if (tagId !== null && tagId !== undefined && tagId > 0) {
      whereClauses.push(
        sql`EXISTS (
          SELECT 1 FROM ${conversationTags}
          WHERE ${conversationTags.conversationId} = ${conversations.id}
            AND ${conversationTags.tagId} = ${tagId}
        )`
      );
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
      ? await dbClient
          .select({ count: sql<number>`count(*)` })
          .from(conversations)
          .where(and(...whereClauses))
      : await dbClient
          .select({ count: sql<number>`count(*)` })
          .from(conversations);
    const total = countResult[0]?.count ? Number(countResult[0].count) : 0;

    // Get conversations
    const convos = whereClauses.length > 0
      ? await dbClient
          .select()
          .from(conversations)
          .where(and(...whereClauses))
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset)
      : await dbClient
          .select()
          .from(conversations)
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset);

    // For each conversation, get latest message, tags, assigned user info, and unread count
    const enrichedConvos = await Promise.all(
      convos.map(async (convo) => {
        const latestMessage = await dbClient
          .select()
          .from(messages)
          .where(eq(messages.conversationId, convo.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const convoTags = await dbClient
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
        const unreadCount = await dbClient
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, convo.id),
              eq(messages.direction, 'inbound')
            )
          );

        // Fetch assigned user name if assigned
        let assignedUserName: string | null = null;
        if (convo.assignedUserId) {
          const assignedUser = await dbClient
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, convo.assignedUserId))
            .limit(1);
          assignedUserName = assignedUser[0]?.email || null;
        }

        // Get unique participants (senders of inbound messages)
        // Phase 2: Add proper participant tracking
        const participants = await dbClient
          .selectDistinct({ senderName: messages.senderName })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, convo.id),
              eq(messages.direction, 'inbound')
            )
          )
          .limit(10);

        const participantList = participants
          .filter((p): p is { senderName: string } => p.senderName !== null && p.senderName.trim().length > 0)
          .map((p) => ({
            id: p.senderName,
            name: p.senderName,
            type: 'contact' as const,
          }));

         return {
           id: convo.id,
           channel: convo.channel,
           externalThreadId: convo.externalThreadId,
           status: convo.status,
           priority: convo.priority,
           assignedUserId: convo.assignedUserId,
           assignedUserName,
           tags: convoTags,
           participants: participantList,
           unreadCount: unreadCount[0]?.count ? Number(unreadCount[0].count) : 0,
           latestMessagePreview: latestMessage[0]?.body || null,
           latestMessageAt: latestMessage[0]?.createdAt || null,
           createdAt: convo.createdAt,
           updatedAt: convo.updatedAt,
         };
      })
    );

    return {
      data: enrichedConvos,
      page,
      pageSize: limit,
      total,
    };
  }

  /**
   * Get a single conversation by ID
   */
  async getConversation(id: string) {
    const convo = await dbClient
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));

    if (!convo.length) {
      throw new Error('Conversation not found');
    }

    // Get tags
    const convoTags = await dbClient
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(conversationTags)
      .innerJoin(tags, eq(tags.id, conversationTags.tagId))
      .where(eq(conversationTags.conversationId, id));

     // Get unique participants (senders of inbound messages)
     const participants = await dbClient
       .selectDistinct({ senderName: messages.senderName })
       .from(messages)
       .where(
         and(
           eq(messages.conversationId, id),
           eq(messages.direction, 'inbound')
         )
       )
       .limit(10);

     const participantList = participants
       .filter((p): p is { senderName: string } => p.senderName !== null && p.senderName.trim().length > 0)
       .map((p) => ({
         id: p.senderName,
         name: p.senderName,
         type: 'contact' as const,
       }));

     return {
       id: convo[0].id,
       channel: convo[0].channel,
       externalThreadId: convo[0].externalThreadId,
       status: convo[0].status,
       priority: convo[0].priority,
       assignedUserId: convo[0].assignedUserId,
       tags: convoTags,
       participants: participantList,
       createdAt: convo[0].createdAt,
       updatedAt: convo[0].updatedAt,
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
    const [conversation] = await dbClient
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
      await dbClient
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

    const [message] = await dbClient
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

    await dbClient
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
    const result = await dbClient
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
    const oldConvo = await dbClient
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
    priority: 'low' | 'normal' | 'high' | 'urgent'
  ) {
    const result = await dbClient
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
  async updatePriority(id: string, priority: 'low' | 'normal' | 'high' | 'urgent') {
    const oldConvo = await dbClient
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
    const result = await dbClient
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
    const oldConvo = await dbClient
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
    const existing = await dbClient
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

    await dbClient.insert(conversationTags).values({
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
    await dbClient
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

  /**
   * List messages for a conversation with pagination
   */
  async listConversationMessages(conversationId: string, offset: number, limit: number) {
    // Verify conversation exists
    const convo = await dbClient
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!convo.length) {
      throw new Error('Conversation not found');
    }

    // Get total count
    const countResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    const total = countResult[0]?.count || 0;

    // Get messages
    const msgs = await dbClient
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      messages: msgs,
      total,
    };
  }
}

export const conversationService = new ConversationService();
