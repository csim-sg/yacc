import type { Platform } from '@yacc/common/types/platform.type';
import { eq, asc, and, sql } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client.js';
import { logger } from '../infrastructure/logger.js';
import { conversations } from '../schemas/conversation.schema.js';
import { messages } from '../schemas/message.schema.js';
import type { Message } from '../schemas/message.schema.js';
import { users } from '../schemas/user.schema.js';
import type { GetMessagesQuery, SendMessageRequestBody } from '../types/message.types.js';
import { connectorManager } from './connector-manager.js';
import { MessageStatusTracker } from './messageStatusTracker.js';

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
   *
   * @param conversationId - Target conversation
   * @param userId - Sender user ID
   * @param userName - Sender display name
   * @param payload - Message body
   * @param correlationId - Optional correlation ID for end-to-end request tracing
   */
  async sendMessage(
    conversationId: string,
    userId: string,
    userName: string,
    payload: SendMessageRequestBody,
    correlationId?: string
  ): Promise<Message> {
    try {
      // Create message with pending status and metadata containing correlationId for async delivery tracing
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
          metadata: correlationId ? { correlationId } : null,
        })
        .returning();

      const message = newMessage[0];

      logger.info(
        {
          messageId: message.id,
          conversationId,
          userId,
          status: 'pending',
          correlationId,
        },
        'Message created'
      );

      // Dispatch to connector asynchronously (don't block response)
      // Pass correlationId for end-to-end tracing through async delivery chain
      this.dispatchToConnector(conversationId, message, userId, correlationId).catch((error) => {
        logger.error(
          {
            messageId: message.id,
            conversationId,
            error: error instanceof Error ? error.message : 'Unknown',
            correlationId,
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
      * 
      * For async delivery with BullMQ retry, failures trigger a BullMQ job for exponential backoff.
      */
    private async dispatchToConnector(
      conversationId: string,
      message: Message,
      userId: string,
      correlationId?: string
    ): Promise<void> {
      let platform: Platform | undefined;

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
              correlationId,
            },
            'Conversation not found for dispatch'
          );
          return;
        }

        platform = conversation.channel as unknown as Platform;
        const platformStr = String(platform);

        logger.debug(
          {
            messageId: message.id,
            conversationId,
            channel: conversation.channel,
            correlationId,
          },
          'Dispatching message to connector'
        );

        // Get connector for this platform
        const connector = connectorManager.getConnector(platformStr);
        if (!connector) {
          throw new Error(`No connector registered for platform: ${platformStr}`);
        }

        // Call connector with SendMessageRequest
        const sendRequest = {
          messageId: message.id,
          conversationId,
          recipientId: conversation.externalThreadId, // For IRC: #channel; for Telegram: chat_id
          body: message.body,
          platformType: platformStr as 'telegram' | 'irc' | 'whatsapp' | 'weChat' | 'meta' | 'twitter',
          correlationId,
        };

        const response = await connector.sendMessage(sendRequest);

        if (response.success) {
          // Update message with external ID and mark as sent
          await dbClient
            .update(messages)
            .set({
              externalMessageId: response.platformMessageId,
              status: 'sent',
              metadata: {
                sentAt: response.sentAt,
                platform: platformStr,
              },
            })
            .where(eq(messages.id, message.id));

          // Track sent status via MessageStatusTracker for WebSocket emission
          await MessageStatusTracker.trackSentMessage({
            messageId: message.id,
            conversationId,
            status: 'sent',
            platform,
            timestamp: new Date(response.sentAt),
          });

          logger.info(
            {
              messageId: message.id,
              conversationId,
              platform: platformStr,
              platformMessageId: response.platformMessageId,
              correlationId,
            },
            'Message dispatched successfully'
          );
        } else {
          // Connector returned failure
          throw new Error(response.error || 'Connector returned failure');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        logger.error(
          {
            messageId: message.id,
            conversationId,
            platform,
            error: errorMsg,
            correlationId,
          },
          'Error dispatching message to connector'
        );

        // Track failed status via MessageStatusTracker (if platform was determined)
        if (platform) {
          try {
            await MessageStatusTracker.trackFailedMessage({
              messageId: message.id,
              conversationId,
              status: 'failed',
              platform,
              error: errorMsg,
              timestamp: new Date(),
            });
          } catch (trackerError) {
            logger.error(
              {
                messageId: message.id,
                error: trackerError instanceof Error ? trackerError.message : 'Unknown',
                correlationId,
              },
              'Failed to track message status'
            );
          }
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

   /**
    * Get message status (for querying message status after sending)
    */
   async getMessageStatus(messageId: string): Promise<'pending' | 'sent' | 'failed' | null> {
     try {
       const result = await dbClient
         .select({ status: messages.status })
         .from(messages)
         .where(eq(messages.id, messageId))
         .limit(1);

       return result[0]?.status || null;
     } catch (error) {
       logger.error(
         {
           messageId,
           error: error instanceof Error ? error.message : 'Unknown error',
         },
         'Failed to fetch message status'
       );
       throw error;
     }
   }
}

export const messageService = new MessageService();
