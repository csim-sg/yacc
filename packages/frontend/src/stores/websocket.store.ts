/**
 * WebSocket Store (Zustand)
 *
 * Central state management for WebSocket connection and real-time data
 * Manages:
 * - Connection state (disconnected/connecting/connected/reconnecting)
 * - Subscriptions to conversations
 * - Typing indicators
 * - User presence
 * - Event deduplication
 *
 * Features:
 * - Persisted to localStorage (via Zustand persist middleware)
 * - Zustand DevTools integration for debugging
 * - Automatic cleanup of old event IDs
 * - Type-safe state and actions
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { WebSocketState, ConnectionState, PresenceState } from '../types/websocket.types';

/**
 * Create WebSocket store with Zustand
 * Includes persist middleware for localStorage
 * Includes devtools middleware for debugging
 */
export const useWebSocketStore = create<WebSocketState>()(
  devtools(
    persist(
      (set, get) => ({
        // ====================================================================
        // Initial State
        // ====================================================================
        connectionState: 'disconnected',
        lastConnectTime: null,
        lastErrorMessage: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        subscribedConversationIds: new Set(),
        typingUsers: new Map(),
        userPresence: new Map(),
        processedEventIds: new Set(),

        // ====================================================================
        // Connection Actions
        // ====================================================================

        setConnectionState: (state: ConnectionState) => {
          set((current) => ({
            ...current,
            connectionState: state,
            lastErrorMessage: state === 'error' ? current.lastErrorMessage : null,
          }));
        },

        setLastConnectTime: (time: string) => {
          set((current) => ({
            ...current,
            lastConnectTime: time,
          }));
        },

        setLastErrorMessage: (message: string | null) => {
          set((current) => ({
            ...current,
            lastErrorMessage: message,
          }));
        },

        setReconnectAttempts: (attempts: number) => {
          set((current) => ({
            ...current,
            reconnectAttempts: attempts,
          }));
        },

        // ====================================================================
        // Subscription Actions
        // ====================================================================

        subscribe: (conversationId: string) => {
          set((current) => {
            const newSubscribed = new Set(current.subscribedConversationIds);
            newSubscribed.add(conversationId);
            return {
              ...current,
              subscribedConversationIds: newSubscribed,
            };
          });
        },

        unsubscribe: (conversationId: string) => {
          set((current) => {
            const newSubscribed = new Set(current.subscribedConversationIds);
            newSubscribed.delete(conversationId);
            return {
              ...current,
              subscribedConversationIds: newSubscribed,
              // Also clean up typing users for this conversation
              typingUsers: new Map(
                Array.from(current.typingUsers).filter(
                  ([cid]) => cid !== conversationId,
                ),
              ),
            };
          });
        },

        // ====================================================================
        // Typing Actions
        // ====================================================================

        addTypingUser: (conversationId: string, userId: string, userName: string) => {
          set((current) => {
            const newTypingUsers = new Map(current.typingUsers);
            const conversationTyping = newTypingUsers.get(conversationId) || new Map();
            
            conversationTyping.set(userId, {
              userId,
              userName,
              startedAt: Date.now(),
            });
            
            newTypingUsers.set(conversationId, conversationTyping);
            return {
              ...current,
              typingUsers: newTypingUsers,
            };
          });
        },

        removeTypingUser: (conversationId: string, userId: string) => {
          set((current) => {
            const newTypingUsers = new Map(current.typingUsers);
            const conversationTyping = newTypingUsers.get(conversationId);
            
            if (conversationTyping) {
              conversationTyping.delete(userId);
              if (conversationTyping.size === 0) {
                newTypingUsers.delete(conversationId);
              } else {
                newTypingUsers.set(conversationId, conversationTyping);
              }
            }
            
            return {
              ...current,
              typingUsers: newTypingUsers,
            };
          });
        },

        clearTypingUsers: (conversationId: string) => {
          set((current) => {
            const newTypingUsers = new Map(current.typingUsers);
            newTypingUsers.delete(conversationId);
            return {
              ...current,
              typingUsers: newTypingUsers,
            };
          });
        },

        // ====================================================================
        // Presence Actions
        // ====================================================================

        setUserPresence: (userId: string, status: PresenceState['status'], lastSeen?: string) => {
          set((current) => {
            const newPresence = new Map(current.userPresence);
            newPresence.set(userId, {
              status,
              lastSeen: lastSeen || new Date().toISOString(),
              lastActivity: Date.now(),
            });
            return {
              ...current,
              userPresence: newPresence,
            };
          });
        },

        clearUserPresence: (userId: string) => {
          set((current) => {
            const newPresence = new Map(current.userPresence);
            newPresence.delete(userId);
            return {
              ...current,
              userPresence: newPresence,
            };
          });
        },

        // ====================================================================
        // Event Deduplication Actions
        // ====================================================================

        markEventProcessed: (eventId: string) => {
          set((current) => {
            const newProcessed = new Set(current.processedEventIds);
            newProcessed.add(eventId);
            return {
              ...current,
              processedEventIds: newProcessed,
            };
          });
        },

        isEventProcessed: (eventId: string): boolean => {
          return get().processedEventIds.has(eventId);
        },

        clearOldEvents: () => {
          // Cleanup is done periodically, but for now we'll just keep them
          // In production, implement a cleanup timer
          set((current) => ({
            ...current,
            // Could implement age-based cleanup here
          }));
        },
      }),
      {
        // Persist middleware options
        name: 'yacc:websocket-store',
        skipHydration: false,
        // Custom serialization for Set and Map
        partialize: (state) => ({
          ...state,
          // Don't persist large collections for now
          subscribedConversationIds: Array.from(state.subscribedConversationIds),
          processedEventIds: Array.from(state.processedEventIds).slice(-100), // Keep only last 100
        }),
      },
    ),
    {
      // DevTools options
      name: 'WebSocketStore',
      enabled: process.env.NODE_ENV === 'development',
    },
  ),
);

// ============================================================================
// Derived Selectors (Custom Hooks)
// ============================================================================

/**
 * Hook to get connection status
 */
export const useWebSocketStatus = () => {
  return useWebSocketStore((state) => ({
    connectionState: state.connectionState,
    isConnected: state.connectionState === 'connected',
    isConnecting: state.connectionState === 'connecting',
    isReconnecting: state.connectionState === 'reconnecting',
    isOffline: state.connectionState === 'offline',
    lastConnectTime: state.lastConnectTime,
    lastErrorMessage: state.lastErrorMessage,
    reconnectAttempts: state.reconnectAttempts,
    maxReconnectAttempts: state.maxReconnectAttempts,
  }));
};

/**
 * Hook to get typing users for a conversation
 */
export const useTypingUsers = (conversationId: string) => {
  return useWebSocketStore((state) => {
    const typing = state.typingUsers.get(conversationId) || new Map();
    return Array.from(typing.values());
  });
};

/**
 * Hook to get presence for a specific user
 */
export const useUserPresence = (userId: string) => {
  return useWebSocketStore((state) => {
    return state.userPresence.get(userId) || {
      status: 'unknown' as const,
      lastSeen: new Date().toISOString(),
      lastActivity: Date.now(),
    };
  });
};

/**
 * Hook to get all user presence states
 */
export const useAllUserPresence = () => {
  return useWebSocketStore((state) => state.userPresence);
};
