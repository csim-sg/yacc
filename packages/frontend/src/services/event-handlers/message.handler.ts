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

import { useWebSocketStore } from '../../stores/websocket.store';
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
import { logger } from '../../lib/logger';

/**
 * Handle message.sent event
 * Updates message status to "sent" and reconciles tempId with serverId
 */
export function handleMessageSent(event: MessageSentEvent): void {
  try {
    logger.debug('[MessageHandler] Handling message.sent', {
      conversationId: event.conversationId,
      messageId: event.messageId,
      serverId: event.serverId,
    });

    // Check for duplicates
    const store = useWebSocketStore.getState();
    if (store.isEventProcessed(event.eventId)) {
      logger.warn('[MessageHandler] Duplicate message.sent event ignored', {
        eventId: event.eventId,
      });
      return;
    }

     // Mark event as processed
     store.markEventProcessed(event.eventId);

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
             id: event.serverId || msg.id, // Use server ID if provided
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
      canRetry: event.canRetry,
    });

    // Check for duplicates
    const store = useWebSocketStore.getState();
    if (store.isEventProcessed(event.eventId)) {
      logger.warn('[MessageHandler] Duplicate message.failed event ignored', {
        eventId: event.eventId,
      });
      return;
    }

     // Mark event as processed
     store.markEventProcessed(event.eventId);

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
 * Adds new inbound message to conversation and updates unread count
 */
export function handleMessageReceived(event: MessageReceivedEvent): void {
  try {
    logger.debug('[MessageHandler] Handling message.received', {
      conversationId: event.conversationId,
      messageId: event.messageId,
      senderName: event.senderName,
    });

    // Check for duplicates
    const store = useWebSocketStore.getState();
    if (store.isEventProcessed(event.eventId)) {
      logger.warn('[MessageHandler] Duplicate message.received event ignored', {
        eventId: event.eventId,
      });
      return;
    }

     // Mark event as processed
     store.markEventProcessed(event.eventId);

     // Create message object from event
     const newMessage: ConversationMessage = {
       id: event.messageId,
       conversationId: event.conversationId,
       senderId: event.senderId || null,
       senderName: event.senderName,
       body: event.body,
       status: 'sent',
       direction: 'inbound',
       externalMessageId: undefined,
       createdAt: event.timestamp,
       updatedAt: event.timestamp,
     };

     // Get current messages for this conversation from cache
     const messagesResponse = queryClient.getQueryData<ListMessagesResponse>([
       'conversationMessages',
       event.conversationId,
     ]);

     if (messagesResponse?.data) {
       // Add new message to messages array
       const updatedMessages = [...messagesResponse.data, newMessage];

       // Update cache with new message
       queryClient.setQueryData(
         ['conversationMessages', event.conversationId],
         {
           ...messagesResponse,
           data: updatedMessages,
           total: messagesResponse.total + 1,
         } as ListMessagesResponse,
       );
     }

     // Update conversations list to increment unread count
     // Note: Use setQueriesData to update all conversations caches (with different filters/params)
     queryClient.setQueriesData(
       { queryKey: ['conversations'] },
       (old: unknown): unknown => {
         interface ConversationWithMetadata {
           id: string;
           unreadCount?: number;
           latestMessagePreview?: string;
           latestMessageAt?: string;
           [key: string]: unknown;
         }

         interface CachedConversations {
           data: ConversationWithMetadata[];
           [key: string]: unknown;
         }

         const conversationsData = old as CachedConversations | undefined;
         if (!conversationsData?.data) return old;

         const updatedConversations = conversationsData.data.map(
           (conv: ConversationWithMetadata): ConversationWithMetadata => {
             if (conv.id === event.conversationId) {
               return {
                 ...conv,
                 unreadCount: (conv.unreadCount || 0) + 1,
                 latestMessagePreview: event.body,
                 latestMessageAt: event.timestamp,
               };
             }
             return conv;
           }
         );

         return {
           ...conversationsData,
           data: updatedConversations,
         };
       },
     );

    logger.info('[MessageHandler] Message received and added', {
      conversationId: event.conversationId,
      messageId: event.messageId,
      senderName: event.senderName,
    });
  } catch (error) {
    logger.error('[MessageHandler] Error handling message.received', error);
  }
}
