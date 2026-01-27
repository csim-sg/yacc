/**
 * Typing Indicator Event Handler
 *
 * Handles server events related to typing indicators:
 * - Typing started
 * - Typing stopped
 *
 * Updates Zustand store with typing state
 * Automatically clears typing indicators after timeout
 */

import { useWebSocketStore } from '../../stores/websocket.store';
import type { TypingStartedEvent, TypingStoppedEvent } from '../../types/websocket.types';
import { logger } from '../../lib/logger';

/**
 * Typing timeout tracking (per conversation)
 * Used to auto-clear typing indicators
 */
const typingTimeouts = new Map<string, Map<string, NodeJS.Timeout>>();

/**
 * Typing timeout duration (milliseconds)
 */
const TYPING_TIMEOUT_MS = 5000; // 5 seconds

/**
 * Handle typing.started event
 * Adds user to typing list and sets auto-clear timeout
 */
export function handleTypingStarted(event: TypingStartedEvent): void {
  try {
    logger.debug('[TypingHandler] Handling typing.started', {
      conversationId: event.conversationId,
      userId: event.userId,
      userName: event.userName,
    });

    // Check for duplicates
    const store = useWebSocketStore.getState();
    if (store.isEventProcessed(event.eventId)) {
      logger.debug('[TypingHandler] Duplicate typing.started event ignored', {
        eventId: event.eventId,
      });
      return;
    }

    // Mark event as processed
    store.markEventProcessed(event.eventId);

    // Add user to typing list
    store.addTypingUser(event.conversationId, event.userId, event.userName);

    // Clear any existing timeout for this user
    const conversationTimeouts = typingTimeouts.get(event.conversationId);
    if (conversationTimeouts?.has(event.userId)) {
      clearTimeout(conversationTimeouts.get(event.userId));
    }

    // Set new timeout to auto-clear typing indicator
    const timeout = setTimeout(() => {
      logger.debug('[TypingHandler] Typing timeout, clearing indicator', {
        conversationId: event.conversationId,
        userId: event.userId,
      });
      store.removeTypingUser(event.conversationId, event.userId);
      
      // Cleanup timeout tracking
      const convTimeouts = typingTimeouts.get(event.conversationId);
      if (convTimeouts) {
        convTimeouts.delete(event.userId);
        if (convTimeouts.size === 0) {
          typingTimeouts.delete(event.conversationId);
        }
      }
    }, TYPING_TIMEOUT_MS);

    // Track timeout for cleanup
    if (!conversationTimeouts) {
      typingTimeouts.set(event.conversationId, new Map());
    }
    typingTimeouts.get(event.conversationId)!.set(event.userId, timeout);

    logger.info('[TypingHandler] User typing', {
      conversationId: event.conversationId,
      userId: event.userId,
    });
  } catch (error) {
    logger.error('[TypingHandler] Error handling typing.started', error);
  }
}

/**
 * Handle typing.stopped event
 * Removes user from typing list and clears timeout
 */
export function handleTypingStopped(event: TypingStoppedEvent): void {
  try {
    logger.debug('[TypingHandler] Handling typing.stopped', {
      conversationId: event.conversationId,
      userId: event.userId,
    });

    // Check for duplicates
    const store = useWebSocketStore.getState();
    if (store.isEventProcessed(event.eventId)) {
      logger.debug('[TypingHandler] Duplicate typing.stopped event ignored', {
        eventId: event.eventId,
      });
      return;
    }

    // Mark event as processed
    store.markEventProcessed(event.eventId);

    // Remove user from typing list
    store.removeTypingUser(event.conversationId, event.userId);

    // Clear timeout
    const conversationTimeouts = typingTimeouts.get(event.conversationId);
    if (conversationTimeouts?.has(event.userId)) {
      clearTimeout(conversationTimeouts.get(event.userId));
      conversationTimeouts.delete(event.userId);

      if (conversationTimeouts.size === 0) {
        typingTimeouts.delete(event.conversationId);
      }
    }

    logger.info('[TypingHandler] User stopped typing', {
      conversationId: event.conversationId,
      userId: event.userId,
    });
  } catch (error) {
    logger.error('[TypingHandler] Error handling typing.stopped', error);
  }
}

/**
 * Cleanup all typing timeouts (call on unmount or disconnect)
 */
export function clearAllTypingTimeouts(): void {
  logger.debug('[TypingHandler] Clearing all typing timeouts');
  
  for (const conversationTimeouts of typingTimeouts.values()) {
    for (const timeout of conversationTimeouts.values()) {
      clearTimeout(timeout);
    }
  }
  
  typingTimeouts.clear();
}
