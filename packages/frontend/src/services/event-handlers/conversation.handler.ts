/**
 * Conversation Event Handler
 *
 * Handles server events related to conversations:
 * - Conversation updates (messages, status, assignments, tags)
 * - Conversation reopened
 *
 * These handlers update both Zustand store and TanStack Query cache
 */

import { useWebSocketStore } from '../../stores/websocket.store';
import { queryClient } from '../../lib/queryClient';
import type { ConversationUpdatedEvent, ConversationReopenedEvent } from '../../types/websocket.types';
import { logger } from '../../lib/logger';

/**
 * Handle conversation.updated event
 * Updates conversation in cache and invalidates related queries
 */
export function handleConversationUpdated(event: ConversationUpdatedEvent): void {
  try {
    logger.debug('[ConversationHandler] Handling conversation.updated', {
      conversationId: event.conversationId,
      changedFields: event.changedFields,
    });

    // Check for duplicates
    const store = useWebSocketStore.getState();
    if (store.isEventProcessed(event.eventId)) {
      logger.warn('[ConversationHandler] Duplicate conversation.updated event ignored', {
        eventId: event.eventId,
      });
      return;
    }

    // Mark event as processed
    store.markEventProcessed(event.eventId);

    // Update TanStack Query cache
    // Key: ['conversations', conversationId]
    queryClient.setQueryData(['conversation', event.conversationId], event.conversation);

    // Invalidate conversation list (for sorting, filtering updates)
    queryClient.invalidateQueries({
      queryKey: ['conversations'],
    });

     // Invalidate timeline if conversation has new messages
     if (event.changedFields.includes('messageCount') || event.changedFields.includes('lastMessage')) {
       queryClient.invalidateQueries({
         queryKey: ['conversationMessages', event.conversationId],
       });
     }

    logger.info('[ConversationHandler] Conversation updated', {
      conversationId: event.conversationId,
    });
  } catch (error) {
    logger.error('[ConversationHandler] Error handling conversation.updated', error);
  }
}

/**
 * Handle conversation.reopened event
 * Updates status and re-fetches conversation data
 */
export function handleConversationReopened(event: ConversationReopenedEvent): void {
  try {
    logger.debug('[ConversationHandler] Handling conversation.reopened', {
      conversationId: event.conversationId,
      reason: event.reason,
    });

    // Check for duplicates
    const store = useWebSocketStore.getState();
    if (store.isEventProcessed(event.eventId)) {
      logger.warn('[ConversationHandler] Duplicate conversation.reopened event ignored', {
        eventId: event.eventId,
      });
      return;
    }

    // Mark event as processed
    store.markEventProcessed(event.eventId);

    // Invalidate conversation to fetch updated status
    queryClient.invalidateQueries({
      queryKey: ['conversation', event.conversationId],
    });

    // Invalidate conversation list
    queryClient.invalidateQueries({
      queryKey: ['conversations'],
    });

    logger.info('[ConversationHandler] Conversation reopened', {
      conversationId: event.conversationId,
    });
  } catch (error) {
    logger.error('[ConversationHandler] Error handling conversation.reopened', error);
  }
}
