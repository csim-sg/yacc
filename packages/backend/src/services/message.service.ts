import { dbClient } from '../infrastructure/db.client.js';
import { messages } from '../schemas/message.schema.js';
import { conversations } from '../schemas/conversation.schema.js';
import { users } from '../schemas/user.schema.js';
import { eq, desc, asc, and, sql } from 'drizzle-orm';
import type { Message } from '../schemas/message.schema.js';
import type { GetMessagesQuery, SendMessageRequestBody } from '../types/message.types.js';
import { logger } from '../infrastructure/logger.js';
import { connectorManager } from './connector-manager.js';

/**
 * Message Service - handles message retrieval and sending
 */
export class MessageService {
  /**
   * Get messages for a conversation with pagination
   */
  async getConversationMessages(
    conversationId: string,
    query: GetMessagesQuery
  ): Promise<{ messages: Message[]; total: number }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const offset = (page - 1) * limit;

    try {
      // Build where clauses
      const whereClauses = [eq(messages.conversationId, conversationId)];

      if (query.direction) {
        whereClauses.push(eq(messages.direction, query.direction));
      }

      // Get total count
      const countResult = await dbClient
        .select({ count: sql<number>`count(*)` })
        .from(messages)
        .where(and(...whereClauses));

      const total = countResult[0]?.count || 0;

      // Fetch paginated, ordered by createdAt asc (oldest first)
      const msgs = await dbClient
        .select()
        .from(messages)
        .where(and(...whereClauses))
        .orderBy(asc(messages.createdAt))
        .limit(limit)
        .offset(offset);

      logger.debug(
        {
          conversationId,
          count: msgs.length,
          total,
          page,
          limit,
        },
        'Fetched messages'
      );

      return { messages: msgs, total };
    } catch (error) {
      logger.error(
        {
          conversationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to fetch messages'
      );
      throw error;
    }
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(
    conversationId: string,
    userId: string,
    userName: string,
    payload: SendMessageRequestBody
  ): Promise<Message> {
    try {
      // Create message with pending status
      const newMessage = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: userId,
          senderName: userName,
          body: payload.body,
          status: 'pending',
          direction: 'outbound',
          externalMessageId: undefined,
          metadata: null,
        })
        .returning();

      const message = newMessage[0];

      logger.info(
        {
          messageId: message.id,
          conversationId,
          userId,
          status: 'pending',
        },
        'Message created'
      );

      // Dispatch to connector asynchronously (don't block response)
      this.dispatchToConnector(conversationId, message, userId).catch((error) => {
        logger.error(
          {
            messageId: message.id,
            conversationId,
            error: error instanceof Error ? error.message : 'Unknown',
          },
          'Connector dispatch failed'
        );
      });

      return message;
    } catch (error) {
      logger.error(
        {
          conversationId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to send message'
      );
      throw error;
    }
  }

  /**
   * Dispatch message to connector and update status
   * This is async and non-blocking; errors are logged but don't fail the original request
   */
  private async dispatchToConnector(
    conversationId: string,
    message: Message,
    userId: string
  ): Promise<void> {
    try {
      // Get conversation details
      const conversation = await dbClient.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });

      if (!conversation) {
      logger.warn(
        {
          conversationId,
          messageId: message.id,
        },
        'Conversation not found for dispatch'
      );
      return;
    }

    logger.debug(
      {
        messageId: message.id,
        conversationId,
        channel: conversation.channel,
      },
      'Dispatching message to connector'
    );

      // For Phase 2A MVP: Use stub connector
      // Stub immediately marks message as sent (simulates successful delivery)
      // In Phase 2B/3, will be replaced with real Telegram/IRC connectors

      // Simulate connector sending (stub behavior for MVP)
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay to simulate I/O

      // Mark as sent (stub connector always succeeds)
      await dbClient
        .update(messages)
        .set({
          status: 'sent',
          updatedAt: new Date(),
        })
        .where(eq(messages.id, message.id));

      logger.info(
        {
          messageId: message.id,
          conversationId,
          status: 'sent',
        },
        'Message dispatched successfully (stub)'
      );

      // TODO: In Phase 2B, emit WebSocket event here
      // socketEmitter.emit('message.sent', { conversationId, message })
    } catch (error) {
      logger.error(
        {
          messageId: message.id,
          conversationId,
          error: error instanceof Error ? error.message : 'Unknown',
        },
        'Error dispatching message to connector'
      );

      // Mark as failed
      try {
        await dbClient
          .update(messages)
          .set({
            status: 'failed',
            metadata: {
              errorDetails: {
                code: 'CONNECTOR_DISPATCH_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
              },
            },
            updatedAt: new Date(),
          })
          .where(eq(messages.id, message.id));

        logger.warn(
          {
            messageId: message.id,
            conversationId,
          },
          'Message marked as failed'
        );
      } catch (updateError) {
        logger.error(
          {
            messageId: message.id,
            error: updateError instanceof Error ? updateError.message : 'Unknown',
          },
          'Failed to update message status to failed'
        );
      }
    }
  }

  /**
   * Get a single message by ID
   */
  async getMessage(messageId: string): Promise<Message | undefined> {
    try {
      const msg = await dbClient.query.messages.findFirst({
        where: eq(messages.id, messageId),
      });
      return msg;
    } catch (error) {
      logger.error(
        {
          messageId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to fetch message'
      );
      throw error;
    }
  }

  /**
   * Check if conversation exists
   */
  async conversationExists(conversationId: string): Promise<boolean> {
    try {
      const result = await dbClient.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
      });
      return !!result;
    } catch (error) {
      logger.error(
        {
          conversationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to check conversation existence'
      );
      throw error;
    }
  }

  /**
   * Get user display name
   */
  async getUserName(userId: string): Promise<string> {
    try {
      const user = await dbClient.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { id: true, email: true },
      });

      if (!user) {
        return 'Unknown User';
      }

      // Extract name from email (before @)
      const name = user.email?.split('@')[0] || 'User';
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch (error) {
      logger.error(
        {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to fetch user name'
      );
      return 'Unknown User';
    }
  }
}

export const messageService = new MessageService();
