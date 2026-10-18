import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';

import { NotificationsStore } from './notifications.store';
import { WS_SOCKET_FACTORY, WebSocketClientService } from './websocket-client.service';
import {
  FakeRealtimeSocket,
  latestFakeSocket,
  resetFakeSockets,
  wsFrame,
} from '../../test/ws-test-socket';
import { NotificationEventsService } from './notification-events.service';

/**
 * NotificationEventsService spec (AC-ANG-006-3/4 handler wiring): the
 * frozen `notification.received` payload writes the NotificationsStore
 * directly (single state location, B6). The retained-no-emitter sibling
 * channels (U1) have no listener — a frame on them never reaches the
 * store (also covered by the client router spec).
 */

const socketFactory = vi.fn((url: string) => new FakeRealtimeSocket(url));

function notificationFrame(type: 'assignment' | 'mention' | 'system'): string {
  return wsFrame('notification.received', {
    id: '00000000-0000-0000-0000-000000000005',
    userId: '00000000-0000-0000-0000-000000000004',
    type,
    conversationId: '00000000-0000-0000-0000-00000000000c',
    actorId: '00000000-0000-0000-0000-00000000000a',
    actorName: 'Alice',
    message: 'You were assigned',
    isRead: false,
    createdAt: '2026-10-18T00:00:00Z',
  });
}

describe('NotificationEventsService', () => {
  let client: WebSocketClientService;
  let notifications: NotificationsStore;
  let binding: Subscription;

  beforeEach(() => {
    localStorage.clear();
    resetFakeSockets(socketFactory);
    TestBed.configureTestingModule({
      providers: [{ provide: WS_SOCKET_FACTORY, useValue: socketFactory }],
    });
    client = TestBed.inject(WebSocketClientService);
    notifications = TestBed.inject(NotificationsStore);
    binding = TestBed.inject(NotificationEventsService).bind();
    client.connect('token-1');
    latestFakeSocket().open();
  });

  afterEach(() => {
    binding.unsubscribe(); // listener teardown
    client.disconnect();
    localStorage.clear();
  });

  it('writes the frozen payload into the store (all frozen type values)', () => {
    latestFakeSocket().message(notificationFrame('assignment'));
    latestFakeSocket().message(notificationFrame('system'));

    const stored = notifications.notifications();
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({
      id: '00000000-0000-0000-0000-000000000005',
      type: 'system',
      actorName: 'Alice',
      isRead: false,
    });
    expect(notifications.unreadCount()).toBe(2);
  });
});
