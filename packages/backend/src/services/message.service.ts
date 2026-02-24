import type { Platform } from '@yacc/common/types/platform.type';
import { eq, asc, and, sql } from 'drizzle-orm';
import { dbClient } from '../infrastructure/db.client.js';
import { logger } from '../infrastructure/logger.js';
import { conversations } from '../schemas/conversation.schema.js';
import { messages } from '../schemas/message.schema.js';
import type { Message } from '../schemas/message.schema.js';
import { users } from '../schemas/user.schema.js';
import type { OutboundMessagePayload } from '../types/gateway.types.js';
import type { GetMessagesQuery, SendMessageRequestBody } from '../types/message.types.js';
import { gatewayExchange } from './gateway-exchange.js';
import { messageQueueService } from './message-queue.service.js';
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
      * Dispatch message to adapter via gateway-exchange and update status
      * This is async and non-blocking; errors are logged but don't fail the original request
      *
      * DEV-006: Uses gateway-exchange for unified outbound dispatch.
      * @see ADR-005 Addendum-2 - Gateway-Exchange Pattern
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

        logger.debug(
          {
            messageId: message.id,
            conversationId,
            channel: conversation.channel,
            correlationId,
          },
          'Dispatching message via gateway-exchange'
        );

        // Build outbound payload for gateway-exchange
        const outboundPayload: OutboundMessagePayload = {
          conversationId,
          body: message.body,
          userId,
          correlationId,
          metadata: {
            recipientId: conversation.externalThreadId, // For IRC: #channel; for Telegram: chat_id
          },
        };

        // Dispatch via gateway-exchange (handles adapter lookup, sending, status updates)
        const result = await gatewayExchange.handleOutbound(outboundPayload, message.id);

        if (result.success) {
          // Track sent status via MessageStatusTracker for WebSocket emission
          await MessageStatusTracker.trackSentMessage({
            messageId: message.id,
            conversationId,
            status: 'sent',
            platform,
            timestamp: result.timestamp,
          });

          logger.info(
            {
              messageId: message.id,
              conversationId,
              platform,
              externalMessageId: result.externalMessageId,
              correlationId,
            },
            'Message dispatched successfully via gateway-exchange'
          );
        } else {
          // Gateway returned failure - status already updated by gateway-exchange
          const errorMsg = result.error?.message || 'Gateway dispatch failed';

          // Track failed status via MessageStatusTracker
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

          logger.warn(
            {
              messageId: message.id,
              conversationId,
              platform,
              error: errorMsg,
              correlationId,
            },
            'Message dispatch failed via gateway-exchange'
          );
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
          'Error dispatching message via gateway-exchange'
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

   /**
    * Check if user is assigned to conversation
    * P0: USER role can only reply/retry on assigned conversations
    */
   async isUserAssignedToConversation(conversationId: string, userId: string): Promise<boolean> {
     try {
       const result = await dbClient.query.conversations.findFirst({
         where: and(eq(conversations.id, conversationId), eq(conversations.assignedUserId, userId)),
       });
       return !!result;
     } catch (error) {
       logger.error(
         {
           conversationId,
           userId,
           error: error instanceof Error ? error.message : 'Unknown error',
         },
         'Failed to check user assignment'
       );
       throw error;
     }
   }

   /**
    * Retry a failed message
    * P0: User-initiated retry exactly once per message
    * Enqueues the message for retry via BullMQ with exponential backoff
    */
   async retryMessage(messageId: string, userId: string, correlationId?: string): Promise<Message> {
     try {
       // Get message
       const message = await this.getMessage(messageId);
       if (!message) {
         throw new Error('Message not found');
       }

       // Only allow retry if message is failed
       if (message.status !== 'failed') {
         throw new Error(`Cannot retry message with status ${message.status}`);
       }

       // Retry failed job via message queue service
       // The queue service handles exponential backoff and status updates
       await messageQueueService.retryFailedJob(messageId);

       logger.info(
         {
           messageId,
           conversationId: message.conversationId,
           userId,
           correlationId,
         },
         'Message retry enqueued'
       );

       // Return updated message (status may still be failed until queue processes it)
       return message;
     } catch (error) {
       logger.error(
         {
           messageId,
           userId,
           error: error instanceof Error ? error.message : 'Unknown error',
           correlationId,
         },
         'Failed to retry message'
       );
       throw error;
     }
   }
}

export const messageService = new MessageService();
