/**
 * Presence Store
 * Tracks user online/offline/away status across the application
 * Syncs with WebSocket events and broadcasts activity
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type PresenceStatus = 'online' | 'offline' | 'away' | 'unknown';

interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastActiveAt?: string;
  updatedAt: string;
}

interface PresenceState {
  /** Map of userId -> presence info */
  presenceMap: Map<string, UserPresence>;

  /** Current user's ID */
  currentUserId?: string;

  /** Current user's activity last updated at */
  activityLastUpdatedAt?: string;

  /** Actions */
  setUserPresence: (userId: string, status: PresenceStatus, lastActiveAt?: string) => void;
  setCurrentUserId: (userId: string) => void;
  updateActivityTimestamp: () => void;
  clearUserPresence: (userId: string) => void;
  clearAllPresence: () => void;
  getUserPresence: (userId: string) => UserPresence | undefined;
  getOnlineUsers: () => UserPresence[];
  isUserOnline: (userId: string) => boolean;
}

/**
 * Presence Store
 * Manages user presence state (online/offline/away)
 */
export const usePresenceStore = create<PresenceState>()(
  devtools(
    persist(
      (set, get) => ({
        presenceMap: new Map(),
        currentUserId: undefined,
        activityLastUpdatedAt: undefined,

        /**
         * Set presence for a user
         * Called when receiving presence updates from WebSocket
         */
        setUserPresence: (userId: string, status: PresenceStatus, lastActiveAt?: string) => {
          set((state) => {
            const newMap = new Map(state.presenceMap);
            newMap.set(userId, {
              userId,
              status,
              lastActiveAt,
              updatedAt: new Date().toISOString(),
            });
            return { presenceMap: newMap };
          });
        },

        /**
         * Set current user's ID
         * Called during auth/login
         */
        setCurrentUserId: (userId: string) => {
          set({ currentUserId: userId });
          // Set self as online
          get().setUserPresence(userId, 'online');
        },

        /**
         * Update activity timestamp
         * Called on mouse/keyboard events to track activity
         * Used to determine "away" status after 15 minutes
         */
        updateActivityTimestamp: () => {
          set({ activityLastUpdatedAt: new Date().toISOString() });
        },

        /**
         * Clear presence for a user
         * Called when user logs out or disconnects
         */
        clearUserPresence: (userId: string) => {
          set((state) => {
            const newMap = new Map(state.presenceMap);
            newMap.delete(userId);
            return { presenceMap: newMap };
          });
        },

        /**
         * Clear all presence data
         * Called on logout
         */
        clearAllPresence: () => {
          set({
            presenceMap: new Map(),
            currentUserId: undefined,
            activityLastUpdatedAt: undefined,
          });
        },

        /**
         * Get presence for a specific user
         */
        getUserPresence: (userId: string) => {
          return get().presenceMap.get(userId);
        },

        /**
         * Get all online users
         */
        getOnlineUsers: () => {
          return Array.from(get().presenceMap.values()).filter(
            (p) => p.status === 'online' || p.status === 'away'
          );
        },

        /**
         * Check if user is online or away (not offline/unknown)
         */
        isUserOnline: (userId: string) => {
          const presence = get().presenceMap.get(userId);
          return presence?.status === 'online' || presence?.status === 'away';
        },
      }),
      {
        name: 'presence-store',
        storage: {
          getItem: (name: string) => {
            const data = localStorage.getItem(name);
            if (!data) return null;
            const parsed = JSON.parse(data);
            // Convert presenceMap array back to Map
            if (parsed.state?.presenceMap && Array.isArray(parsed.state.presenceMap)) {
              parsed.state.presenceMap = new Map(parsed.state.presenceMap);
            }
            return parsed;
          },
          setItem: (name: string, value) => {
            const toStore = {
              ...value,
              state: {
                ...value.state,
                // Convert Map to array for JSON serialization
                presenceMap: Array.from(value.state.presenceMap || []),
              },
            };
            localStorage.setItem(name, JSON.stringify(toStore));
          },
          removeItem: (name: string) => localStorage.removeItem(name),
        },
      }
    ),
    { name: 'PresenceStore' }
  )
);

/**
 * Derived selector: Get presence for a user
 */
export const useUserPresence = (userId: string) => {
  return usePresenceStore((state) => state.getUserPresence(userId));
};

/**
 * Derived selector: Check if user is online
 */
export const useIsUserOnline = (userId: string) => {
  return usePresenceStore((state) => state.isUserOnline(userId));
};

/**
 * Derived selector: Get all online users
 */
export const useOnlineUsers = () => {
  return usePresenceStore((state) => state.getOnlineUsers());
};

/**
 * Derived selector: Get current user's presence
 */
export const useCurrentUserPresence = () => {
  const { currentUserId, getUserPresence } = usePresenceStore();
  return currentUserId ? getUserPresence(currentUserId) : undefined;
};
