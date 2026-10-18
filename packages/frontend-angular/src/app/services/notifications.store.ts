import { Injectable, computed, signal } from '@angular/core';

/**
 * In-app notification row — aligned 1:1 with the frozen WS contract's
 * `notification.received` payload (`contracts/ws/events.schema.ts`), which
 * is what the ANG-006 handler feeds into this store. The React store's
 * extra `title`/`action` fields were never wire-backed and are dropped
 * (single canonical state location, B6 fix). `type` carries the frozen
 * wire enum (`schemas/notification.schema.json`: assignment|mention|
 * system) — the Node-era declared `unread` value was never sent and is
 * not part of the frozen contract.
 */
export interface Notification {
  id: string;
  userId: string;
  type: 'assignment' | 'mention' | 'system';
  conversationId: string;
  actorId?: string;
  actorName?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/** Cap of stored notifications (React `MAX_NOTIFICATIONS`). */
const MAX_NOTIFICATIONS = 100;

const STORAGE_KEY = 'notifications-store';

/** Structural guard for persisted rows (client-internal state, no Zod). */
function isNotification(value: unknown): value is Notification {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'userId' in value &&
    typeof value.userId === 'string' &&
    'type' in value &&
    typeof value.type === 'string' &&
    'conversationId' in value &&
    typeof value.conversationId === 'string' &&
    'message' in value &&
    typeof value.message === 'string' &&
    'isRead' in value &&
    typeof value.isRead === 'boolean' &&
    'createdAt' in value &&
    typeof value.createdAt === 'string'
  );
}

/**
 * Notifications signal store (T2 §3.2 `notifications.store` row — LIVE):
 * same boundaries as the React Zustand store (cap 100, newest first,
 * unread count, persisted to localStorage). Single canonical location —
 * the WS handler writes THIS store directly (fixes the verified B6
 * duplicate-cache link); there is no REST notifications fetch (F7 gap
 * remains a recorded contract gap, not invented here).
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly notificationsSignal = signal<Notification[]>(loadPersisted());
  /** Stored notifications, newest first (max 100). */
  readonly notifications = this.notificationsSignal.asReadonly();

  /** Count of unread notifications. */
  readonly unreadCount = computed(
    () => this.notificationsSignal().filter((notification) => !notification.isRead).length,
  );

  /** Add a notification (prepended; the cap trims the oldest tail). */
  addNotification(notification: Notification): void {
    this.notificationsSignal.set([notification, ...this.notificationsSignal()].slice(0, MAX_NOTIFICATIONS));
    this.persist();
  }

  removeNotification(notificationId: string): void {
    this.notificationsSignal.set(
      this.notificationsSignal().filter((notification) => notification.id !== notificationId),
    );
    this.persist();
  }

  markAsRead(notificationId: string): void {
    this.notificationsSignal.set(
      this.notificationsSignal().map((notification) =>
        notification.id === notificationId ? { ...notification, isRead: true } : notification,
      ),
    );
    this.persist();
  }

  markAllAsRead(): void {
    this.notificationsSignal.set(
      this.notificationsSignal().map((notification) => ({ ...notification, isRead: true })),
    );
    this.persist();
  }

  clearAll(): void {
    this.notificationsSignal.set([]);
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notificationsSignal()));
  }
}

/** Restore persisted notifications, dropping rows that fail the guard. */
function loadPersisted(): Notification[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isNotification) : [];
  } catch {
    return [];
  }
}
