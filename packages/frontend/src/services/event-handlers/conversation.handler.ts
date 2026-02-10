/**
 * Conversation Event Handler
 *
 * Handles server events related to conversations:
 * - Conversation updates (messages, status, assignments, tags)
 * - Conversation reopened
 *
 * These handlers update both Zustand store and TanStack Query cache
 */

import { logger } from '../../lib/logger';
import { queryClient } from '../../lib/queryClient';
import { useWebSocketStore } from '../../stores/websocket.store';
import type { ConversationUpdatedEvent, ConversationReopenedEvent } from '../../types/websocket.types';

/**
 * Handle conversation.updated event
 * Backend emits when: status/priority/assignment changes
 * Invalidates caches to refetch from server
 */
export function handleConversationUpdated(event: ConversationUpdatedEvent): void {
   try {
     logger.info('[ConversationHandler] Handling conversation.updated', {
       conversationId: event.conversationId,
       changedBy: event.changedBy,
       changedAt: event.changedAt,
     });

     // Note: Backend doesn't send eventId, so deduplication is not available
     // Updates are idempotent (invalidate to refetch fresh data)

     // Invalidate conversation detail and list to refetch fresh data from server
     queryClient.invalidateQueries({
       queryKey: ['conversation', event.conversationId],
     });

     // Invalidate conversation list (for sorting, filtering updates)
     queryClient.invalidateQueries({
       queryKey: ['conversations'],
     });

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
