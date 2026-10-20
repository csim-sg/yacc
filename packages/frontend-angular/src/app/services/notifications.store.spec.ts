import { TestBed } from '@angular/core/testing';

import { NotificationsStore } from './notifications.store';

/**
 * NotificationsStore spec (AC-ANG-005-2; T2 §3.2 `notifications.store`
 * row — LIVE): cap 100, newest-first prepend, unread count, mark/clear
 * flows, and localStorage persistence (single canonical location, B6).
 */
describe('NotificationsStore', () => {
  let store: NotificationsStore;

  function notification(id: string, isRead = false) {
    return {
      id,
      userId: 'u1',
      type: 'mention' as const,
      conversationId: 'c1',
      message: `note ${id}`,
      isRead,
      createdAt: '2026-10-18T00:00:00',
    };
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(NotificationsStore);
  });

  it('starts empty and tracks unread count', () => {
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
  });

  it('prepends new notifications and computes the unread count', () => {
    store.addNotification(notification('n1'));
    store.addNotification(notification('n2'));
    store.addNotification(notification('n3', true));

    expect(store.notifications().map((row) => row.id)).toEqual(['n3', 'n2', 'n1']);
    expect(store.unreadCount()).toBe(2);
  });

  it('caps the stored notifications at 100 (oldest trimmed)', () => {
    for (let index = 0; index < 105; index += 1) {
      store.addNotification(notification(`n${index}`));
    }

    const rows = store.notifications();
    expect(rows).toHaveLength(100);
    expect(rows[0]?.id).toBe('n104');
    expect(rows[99]?.id).toBe('n5');
  });

  it('marks one or all notifications read', () => {
    store.addNotification(notification('n1'));
    store.addNotification(notification('n2'));

    store.markAsRead('n1');
    expect(store.unreadCount()).toBe(1);

    store.markAllAsRead();
    expect(store.unreadCount()).toBe(0);
    expect(store.notifications().every((row) => row.isRead)).toBe(true);
  });

  it('removes one notification and clears all', () => {
    store.addNotification(notification('n1'));
    store.addNotification(notification('n2'));

    store.removeNotification('n1');
    expect(store.notifications().map((row) => row.id)).toEqual(['n2']);

    store.clearAll();
    expect(store.notifications()).toEqual([]);
    expect(store.unreadCount()).toBe(0);
  });

  it('persists to localStorage and restores valid rows (dropping malformed)', () => {
    store.addNotification(notification('n1'));
    store.addNotification(notification('n2', true));

    const restored = new NotificationsStore();
    expect(restored.notifications().map((row) => row.id)).toEqual(['n2', 'n1']);

    localStorage.setItem(
      'notifications-store',
      JSON.stringify([{ id: 'junk' }, 'not-an-object', notification('n3')]),
    );
    const lenient = new NotificationsStore();
    expect(lenient.notifications().map((row) => row.id)).toEqual(['n3']);
  });

  it('ignores unparsable persisted payloads', () => {
    localStorage.setItem('notifications-store', 'not-json');

    const restored = new NotificationsStore();
    expect(restored.notifications()).toEqual([]);
  });
});
