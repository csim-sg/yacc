/**
 * Offline Queue Store (Zustand)
 *
 * Manages messages sent while offline
 * Features:
 * - Persists to localStorage (survives page refresh)
 * - FIFO ordering
 * - Max queue size limit (50 messages)
 * - Status tracking (pending/syncing/failed)
 * - Error tracking per message
 *
 * Usage:
 * ```typescript
 * import { useOfflineQueue } from '../stores/offline-queue.store';
 *
 * const { addMessage, messages, syncing } = useOfflineQueue();
 * ```
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { OfflineMessage, OfflineQueueState } from '../types/websocket.types';
import { logger } from '../lib/logger';

/**
 * Max queue size (number of messages)
 */
const MAX_QUEUE_SIZE = 50;

/**
 * Create offline queue store with Zustand
 */
export const useOfflineQueue = create<OfflineQueueState>()(
  devtools(
    persist(
      (set) => ({
        // ====================================================================
        // Initial State
        // ====================================================================
        messages: [],
        syncing: false,
        syncError: null,
        lastSyncTime: null,

        // ====================================================================
        // Queue Management Actions
        // ====================================================================

        addMessage: (message: Omit<OfflineMessage, 'status' | 'timestamp'>) => {
          set((state) => {
            // Check queue size limit
            if (state.messages.length >= MAX_QUEUE_SIZE) {
              logger.warn('[OfflineQueue] Queue size limit reached (50 messages)');
              return state;
            }

            const newMessage: OfflineMessage = {
              ...message,
              status: 'pending',
              timestamp: Date.now(),
            };

            return {
              ...state,
              messages: [...state.messages, newMessage],
            };
          });
        },

        removeMessage: (tempId: string) => {
          set((state) => ({
            ...state,
            messages: state.messages.filter((msg) => msg.tempId !== tempId),
          }));
        },

        clearQueue: () => {
          set((state) => ({
            ...state,
            messages: [],
            syncError: null,
          }));
        },

        setSyncing: (syncing: boolean) => {
          set((state) => ({
            ...state,
            syncing,
            syncError: syncing ? null : state.syncError,
          }));
        },

        setSyncError: (error: string | null) => {
          set((state) => ({
            ...state,
            syncError: error,
            syncing: false,
          }));
        },

        setLastSyncTime: (time: number) => {
          set((state) => ({
            ...state,
            lastSyncTime: time,
          }));
        },

        updateMessageStatus: (
          tempId: string,
          status: OfflineMessage['status'],
          error?: string,
        ) => {
          set((state) => ({
            ...state,
            messages: state.messages.map((msg) => {
              if (msg.tempId === tempId) {
                return {
                  ...msg,
                  status,
                  error,
                };
              }
              return msg;
            }),
          }));
        },
      }),
      {
        // Persist middleware options
        name: 'yacc:offline-queue',
        skipHydration: false,
      },
    ),
    {
      // DevTools options
      name: 'OfflineQueueStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);

// ============================================================================
// Derived Selectors (Custom Hooks)
// ============================================================================

/**
 * Hook to get queue status
 */
export const useOfflineQueueStatus = () => {
  return useOfflineQueue((state) => ({
    messageCount: state.messages.length,
    hasMessages: state.messages.length > 0,
    isFull: state.messages.length >= MAX_QUEUE_SIZE,
    syncing: state.syncing,
    syncError: state.syncError,
    lastSyncTime: state.lastSyncTime,
  }));
};

/**
 * Hook to get pending messages (ready to sync)
 */
export const usePendingMessages = () => {
  return useOfflineQueue((state) =>
    state.messages.filter((msg) => msg.status === 'pending' || msg.status === 'failed'),
  );
};
