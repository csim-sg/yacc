/**
 * Message Event Handler
 *
 * Handles server events related to message delivery:
 * - Message sent (confirmation)
 * - Message failed (delivery error)
 * - Message received (inbound from external platform)
 *
 * Updates message status in timeline and handles retries
 */

import { logger } from '../../lib/logger';
import { queryClient } from '../../lib/queryClient';
import type {
  MessageReceivedEvent,
  MessageSentEvent,
  MessageFailedEvent,
} from '../../types/websocket.types';
import type {
  ConversationMessage,
  ListMessagesResponse,
} from '../conversations.service';

/**
 * Handle message.sent event
 * Updates message status to "sent"
 */
export function handleMessageSent(event: MessageSentEvent): void {
   try {
     logger.debug('[MessageHandler] Handling message.sent', {
       conversationId: event.conversationId,
       messageId: event.messageId,
       sentAt: event.sentAt,
     });

     // Note: Backend doesn't send eventId, so deduplication is not available
     // Duplicate handling will be managed by message ID uniqueness

     // Get current messages from cache
     const messagesResponse = queryClient.getQueryData<ListMessagesResponse>([
       'conversationMessages',
       event.conversationId,
     ]);

     if (messagesResponse?.data) {
       // Find message by messageId and update status
       const updatedMessages = messagesResponse.data.map((msg): ConversationMessage => {
         if (msg.id === event.messageId) {
           return {
             ...msg,
             status: 'sent' as const,
           };
         }
         return msg;
       });

       // Update cache with complete response
       queryClient.setQueryData(
         ['conversationMessages', event.conversationId],
         {
           ...messagesResponse,
           data: updatedMessages,
         } as ListMessagesResponse,
       );
     }

     // Invalidate conversations list to update "last message" and timestamp
     queryClient.invalidateQueries({
       queryKey: ['conversations'],
     });

    logger.info('[MessageHandler] Message sent', {
      conversationId: event.conversationId,
      messageId: event.messageId,
    });
  } catch (error) {
    logger.error('[MessageHandler] Error handling message.sent', error);
  }
}

/**
 * Handle message.failed event
 * Updates message status to "failed" and shows error
 */
export function handleMessageFailed(event: MessageFailedEvent): void {
   try {
     logger.warn('[MessageHandler] Handling message.failed', {
       conversationId: event.conversationId,
       messageId: event.messageId,
       error: event.error,
       retryAt: event.retryAt,
       attempt: event.attempt,
     });

     // Note: Backend doesn't send eventId, so deduplication is not available

     // Get current messages from cache
     const messagesResponse = queryClient.getQueryData<ListMessagesResponse>([
       'conversationMessages',
       event.conversationId,
     ]);

      if (messagesResponse?.data) {
        // Find message and update status
        const updatedMessages = messagesResponse.data.map((msg): ConversationMessage => {
          if (msg.id === event.messageId) {
            return {
              ...msg,
              status: 'failed' as const,
            };
          }
          return msg;
        });

        // Update cache with complete response
        queryClient.setQueryData(
          ['conversationMessages', event.conversationId],
          {
            ...messagesResponse,
            data: updatedMessages,
          } as ListMessagesResponse,
        );
      }

      // Invalidate conversations list to update failed status
      queryClient.invalidateQueries({
        queryKey: ['conversations'],
      });

     logger.info('[MessageHandler] Message failed', {
       conversationId: event.conversationId,
       messageId: event.messageId,
       error: event.error,
     });
   } catch (error) {
     logger.error('[MessageHandler] Error handling message.failed', error);
   }
}

/**
 * Handle message.received event
 * Backend emits when external platform (Telegram, IRC) sends new message
 * Adds inbound message to conversation without manual refresh
 */
export function handleMessageReceived(event: MessageReceivedEvent): void {
  try {
    logger.debug('[MessageHandler] Handling message.received', {
      conversationId: event.conversationId,
      messageId: event.messageId,
      platform: event.platform,
      senderName: event.senderName,
      timestamp: event.timestamp,
    });

    // Get current messages from cache
    const messagesResponse = queryClient.getQueryData<ListMessagesResponse>([
      'conversationMessages',
      event.conversationId,
    ]);

    if (messagesResponse?.data) {
      // Check if message already exists (avoid duplicates)
      const messageExists = messagesResponse.data.some((msg) => msg.id === event.messageId);

      if (!messageExists) {
        // Create new inbound message object
        const newMessage: ConversationMessage = {
          id: event.messageId,
          conversationId: event.conversationId,
          senderId: event.senderId,
          senderName: event.senderName,
          body: event.body,
          status: 'sent' as const, // Inbound messages are already delivered by platform
          direction: 'inbound' as const,
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
        };

        // Add to beginning of messages array (most recent first)
        const updatedMessages = [newMessage, ...messagesResponse.data];

        // Update cache
        queryClient.setQueryData(
          ['conversationMessages', event.conversationId],
          {
            ...messagesResponse,
            data: updatedMessages,
          } as ListMessagesResponse,
        );
      }
    }

    // Invalidate conversations list to update "last message" and timestamp
    queryClient.invalidateQueries({
      queryKey: ['conversations'],
    });

    logger.info('[MessageHandler] Inbound message added to conversation', {
      conversationId: event.conversationId,
      messageId: event.messageId,
      platform: event.platform,
    });
  } catch (error) {
    logger.error('[MessageHandler] Error handling message.received', error);
  }
}
