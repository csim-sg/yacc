/**
 * Message Event Handler
 *
 * Handles server events related to message delivery:
 * - Message sent (confirmation)
 * - Message failed (delivery error)
 *
 * Updates message status in timeline and handles retries
 */

import { useWebSocketStore } from '../../stores/websocket.store';
import { queryClient } from '../../lib/queryClient';
import type { MessageSentEvent, MessageFailedEvent } from '../../types/websocket.types';
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
    const messagesData = queryClient.getQueryData<any[]>([
      'conversation',
      event.conversationId,
      'messages',
    ]);

    if (messagesData) {
      // Find message by tempId or messageId and update status
      const updatedMessages = messagesData.map((msg) => {
        if (msg.id === event.messageId || msg.tempId === event.messageId) {
          return {
            ...msg,
            id: event.serverId || msg.id, // Use server ID if provided
            status: 'sent' as const,
            sentAt: event.timestamp,
          };
        }
        return msg;
      });

      // Update cache
      queryClient.setQueryData(
        ['conversation', event.conversationId, 'messages'],
        updatedMessages,
      );
    }

    // Invalidate conversation to update "last message" and timestamp
    queryClient.invalidateQueries({
      queryKey: ['conversation', event.conversationId],
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
    const messagesData = queryClient.getQueryData<any[]>([
      'conversation',
      event.conversationId,
      'messages',
    ]);

    if (messagesData) {
      // Find message and update status
      const updatedMessages = messagesData.map((msg) => {
        if (msg.id === event.messageId || msg.tempId === event.messageId) {
          return {
            ...msg,
            status: 'failed' as const,
            error: event.error,
            canRetry: event.canRetry,
            failedAt: event.timestamp,
          };
        }
        return msg;
      });

      // Update cache
      queryClient.setQueryData(
        ['conversation', event.conversationId, 'messages'],
        updatedMessages,
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
