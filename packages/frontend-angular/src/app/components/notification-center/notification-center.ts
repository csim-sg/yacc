import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { logger } from '../../lib/logger';
import { NotificationsStore } from '../../services/notifications.store';
import type { Notification } from '../../services/notifications.store';

/**
 * NotificationCenter (React `NotificationCenter.tsx` port — W17).
 *
 * Dropdown bell icon with the unread badge, the notification list and the
 * mark-read / dismiss / mark-all / clear-all controls, plus the
 * click-through navigation to `/conversations/:id`.
 *
 * State reads the SINGLE canonical `NotificationsStore` (B6 fix — the
 * socket handler writes this store directly; there is no duplicate
 * container and no REST notifications fetch). P0 filter parity: only
 * assignment notifications are listed. No WS push is claimed (U1 — the
 * panel mechanics + click-through are the covered surface; the frozen
 * sibling channels have no backend emitter, parity-of-absence).
 */
@Component({
  selector: 'app-notification-center',
  host: {
    // Close on outside click (React document `mousedown` listener parity):
    // a press anywhere outside this component's DOM closes the panel.
    '(document:mousedown)': 'onDocumentMousedown($event)',
  },
  templateUrl: './notification-center.html',
})
export class NotificationCenter {
  private readonly router = inject(Router);
  private readonly store = inject(NotificationsStore);
  private readonly host = inject(ElementRef);

  /** Whether the dropdown panel is open. */
  protected readonly isOpen = signal(false);

  /** P0 filter parity: assignment notifications only. */
  protected readonly notifications = computed(() =>
    this.store.notifications().filter((notification) => notification.type === 'assignment'),
  );

  /** Unread count within the filtered list (badge + panel header). */
  protected readonly unreadCount = computed(
    () => this.notifications().filter((notification) => !notification.isRead).length,
  );

  protected toggle(): void {
    this.isOpen.update((open) => !open);
  }

  protected onDocumentMousedown(event: MouseEvent): void {
    if (
      this.isOpen() &&
      event.target instanceof Node &&
      !this.host.nativeElement.contains(event.target)
    ) {
      this.isOpen.set(false);
    }
  }

  /**
   * Item click: mark as read when unread, then click through to the
   * conversation (React `onClickThrough` parity — the panel closes and
   * navigation happens only when the notification carries a
   * conversation).
   */
  protected openNotification(notification: Notification): void {
    if (!notification.isRead) {
      this.markAsRead(notification);
    }
    if (notification.conversationId) {
      this.isOpen.set(false);
      void this.router.navigateByUrl(`/conversations/${notification.conversationId}`);
    }
  }

  protected markAsRead(notification: Notification): void {
    this.store.markAsRead(notification.id);
    logger.debug('Marked notification as read', { id: notification.id });
  }

  protected dismiss(notification: Notification): void {
    this.store.removeNotification(notification.id);
    logger.debug('Dismissed notification', { id: notification.id });
  }

  protected markAllAsRead(): void {
    this.store.markAllAsRead();
  }

  /** Locale time string (React `toLocaleTimeString` parity). */
  protected formatTime(createdAt: string): string {
    return new Date(createdAt).toLocaleTimeString();
  }

  protected clearAll(): void {
    this.store.clearAll();
    this.isOpen.set(false);
    logger.debug('Cleared all notifications');
  }
}
