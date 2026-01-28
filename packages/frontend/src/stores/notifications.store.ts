/**
 * Notifications Store
 * Manages in-app notifications for assignments, mentions, and messages
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type NotificationType = 'assignment' | 'mention' | 'unread_message';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  conversationId: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  createdAt: string;
  action?: {
    label: string;
    href: string;
  };
}

interface NotificationsState {
  /** All notifications */
  notifications: Notification[];

  /** Unread count */
  unreadCount: number;

  /** Actions */
  addNotification: (notification: Notification) => void;
  removeNotification: (notificationId: string) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  getUnreadCount: () => number;
  getNotifications: (limit?: number) => Notification[];
}

const MAX_NOTIFICATIONS = 100;

/**
 * Notifications Store
 * Manages in-app notifications
 */
export const useNotificationsStore = create<NotificationsState>()(
  devtools(
    persist(
      (set, get) => ({
        notifications: [],
        unreadCount: 0,

        /**
         * Add a new notification
         * Keeps max 100 notifications
         */
        addNotification: (notification: Notification) => {
          set((state) => {
            const newNotifications = [notification, ...state.notifications];
            // Keep only recent notifications
            const trimmed = newNotifications.slice(0, MAX_NOTIFICATIONS);
            const unreadCount = trimmed.filter((n) => !n.isRead).length;

            return {
              notifications: trimmed,
              unreadCount,
            };
          });
        },

        /**
         * Remove a notification
         */
        removeNotification: (notificationId: string) => {
          set((state) => {
            const filtered = state.notifications.filter((n) => n.id !== notificationId);
            const unreadCount = filtered.filter((n) => !n.isRead).length;

            return {
              notifications: filtered,
              unreadCount,
            };
          });
        },

        /**
         * Mark a notification as read
         */
        markAsRead: (notificationId: string) => {
          set((state) => {
            const updated = state.notifications.map((n) => {
              if (n.id === notificationId) {
                return { ...n, isRead: true };
              }
              return n;
            });
            const unreadCount = updated.filter((n) => !n.isRead).length;

            return {
              notifications: updated,
              unreadCount,
            };
          });
        },

        /**
         * Mark all notifications as read
         */
        markAllAsRead: () => {
          set((state) => {
            const updated = state.notifications.map((n) => ({ ...n, isRead: true }));

            return {
              notifications: updated,
              unreadCount: 0,
            };
          });
        },

        /**
         * Clear all notifications
         */
        clearAll: () => {
          set({
            notifications: [],
            unreadCount: 0,
          });
        },

        /**
         * Get unread count
         */
        getUnreadCount: () => {
          return get().unreadCount;
        },

        /**
         * Get notifications (optionally limited)
         */
        getNotifications: (limit?: number) => {
          const notifications = get().notifications;
          return limit ? notifications.slice(0, limit) : notifications;
        },
      }),
      {
        name: 'notifications-store',
      }
    ),
    { name: 'NotificationsStore' }
  )
);

/**
 * Derived selectors
 */

export const useUnreadCount = () => {
  return useNotificationsStore((state) => state.unreadCount);
};

export const useNotifications = (limit?: number) => {
  return useNotificationsStore((state) =>
    limit ? state.notifications.slice(0, limit) : state.notifications
  );
};

export const useHasUnread = () => {
  return useNotificationsStore((state) => state.unreadCount > 0);
};
