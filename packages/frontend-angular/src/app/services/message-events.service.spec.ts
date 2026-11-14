import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';

import { ConversationsStore } from './conversations.store';
import { ConversationsService } from './conversations.service';
import { MessagesStore } from './messages.store';
import { MessagesService } from './messages.service';
import { WS_SOCKET_FACTORY, WebSocketClientService } from './websocket-client.service';
import { ConversationSubscriptionService } from './conversation-subscription.service';
import {
  FakeRealtimeSocket,
  latestFakeSocket,
  resetFakeSockets,
  wsFrame,
} from '../../test/ws-test-socket';
import { MessageEventsService } from './message-events.service';

/**
 * MessageEventsService spec (AC-ANG-006-3 handler wiring + #499 AC-4/5):
 * the frozen `message.*` channels write the ANG-005 messages store —
 * append behind the message-id re-delivery dedup for `message.received`,
 * id-agnostic status patches for `message.sent` / `message.failed` — and
 * the receive path patches the loaded conversations list LOCALLY
 * (`latestMessagePreview` + `unreadCount` for a non-active conversation
 * only) WITHOUT the blanket list invalidation (the connector relay is
 * publish-only: a refetch would clobber the patch with stale rows).
 */

const socketFactory = vi.fn((url: string) => new FakeRealtimeSocket(url));

const CONVERSATION_ID = '00000000-0000-0000-0000-00000000000c';
const OTHER_CONVERSATION_ID = '00000000-0000-0000-0000-0000000000d0';
const MESSAGE_ID = '00000000-0000-0000-0000-000000000002';

function storedMessage(id: string) {
  return {
    id,
    conversationId: CONVERSATION_ID,
    senderId: '00000000-0000-0000-0000-000000000004',
    senderName: 'Alice',
    body: 'hello',
    status: 'sent' as const,
    direction: 'outbound' as const,
    createdAt: '2026-10-18T00:00:00',
    updatedAt: '2026-10-18T00:00:00',
  };
}

/** One conversation-list row with a seeded unread counter. */
function listRow(id: string, unreadCount = 2) {
  return {
    id,
    channel: 'telegram' as const,
    externalThreadId: `thread-${id}`,
    title: 'Support thread',
    status: 'open' as const,
    priority: 'normal' as const,
    unreadCount,
    latestMessagePreview: 'old preview',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-19T00:00:00Z',
  };
}

const INBOUND_FRAME = {
  messageId: MESSAGE_ID,
  conversationId: CONVERSATION_ID,
  platform: 'telegram' as const,
  senderId: 'tg-1',
  senderName: 'Bob',
  body: 'fresh inbound body',
  timestamp: '2026-10-18T00:01:00Z',
};

describe('MessageEventsService', () => {
  let service: MessageEventsService;
  let client: WebSocketClientService;
  let messages: MessagesStore;
  let conversations: ConversationsStore;
  let subscriptions: ConversationSubscriptionService;
  let binding: Subscription;

  beforeEach(async () => {
    resetFakeSockets(socketFactory);
    TestBed.configureTestingModule({
      providers: [{ provide: WS_SOCKET_FACTORY, useValue: socketFactory }],
    });
    service = TestBed.inject(MessageEventsService);
    client = TestBed.inject(WebSocketClientService);
    messages = TestBed.inject(MessagesStore);
    conversations = TestBed.inject(ConversationsStore);
    subscriptions = TestBed.inject(ConversationSubscriptionService);

    // Seed the conversation's message-list cache through the store (the
    // HTTP services are spied — no HttpClient wiring is needed).
    vi.spyOn(TestBed.inject(MessagesService), 'list').mockResolvedValue({
      messages: [storedMessage('00000000-0000-0000-0000-000000000001')],
      total: 1,
      page: 1,
      limit: 50,
    });
    await messages.loadMessages(CONVERSATION_ID);

    binding = service.bind();
    client.connect('token-1');
    latestFakeSocket().open();
  });

  afterEach(() => {
    binding.unsubscribe(); // listener teardown
    client.disconnect();
    subscriptions.reset();
  });

  function seedListRow(unreadCount = 2): void {
    vi.spyOn(TestBed.inject(ConversationsService), 'list').mockResolvedValue({
      data: [listRow(CONVERSATION_ID, unreadCount)],
      total: 1,
      page: 1,
      limit: 20,
    });
  }

  async function loadInboxList(unreadCount = 2): Promise<void> {
    seedListRow(unreadCount);
    await conversations.loadList({});
  }

  function listRowSnapshot() {
    const entry = conversations.listSnapshot({})?.data?.data[0];
    return { preview: entry?.latestMessagePreview, unread: entry?.unreadCount };
  }

  it('appends an inbound message.received row to the loaded list without the blanket invalidation', async () => {
    await loadInboxList();
    const lists = vi.spyOn(conversations, 'invalidateLists');

    latestFakeSocket().message(wsFrame('message.received', INBOUND_FRAME));

    const snapshot = messages.listSnapshot(CONVERSATION_ID)?.data;
    expect(snapshot?.messages).toHaveLength(2);
    expect(snapshot?.total).toBe(2);
    expect(snapshot?.messages.at(-1)).toMatchObject({
      id: MESSAGE_ID,
      direction: 'inbound',
      status: 'sent',
      createdAt: '2026-10-18T00:01:00Z',
    });
    // #499 AC-5: the relay does not persist — the receive path patches
    // locally and never triggers the stale-data refetch.
    expect(lists).not.toHaveBeenCalled();
  });

  it('patches the loaded list preview and increments unread for a NON-active conversation', async () => {
    await loadInboxList(2);

    latestFakeSocket().message(wsFrame('message.received', INBOUND_FRAME));

    expect(listRowSnapshot()).toEqual({ preview: 'fresh inbound body', unread: 3 });
  });

  it('never increments unread for the ACTIVE conversation (preview still patched)', async () => {
    await loadInboxList(2);
    // The conversation is open in the detail: subscribe + ack it.
    subscriptions.setActive(CONVERSATION_ID);
    latestFakeSocket().message(wsFrame('conversation.subscribed', { conversationId: CONVERSATION_ID }));

    latestFakeSocket().message(wsFrame('message.received', INBOUND_FRAME));

    expect(listRowSnapshot()).toEqual({ preview: 'fresh inbound body', unread: 2 });
  });

  it('re-delivery is idempotent — unread and preview apply exactly once', async () => {
    await loadInboxList(2);
    const frame = wsFrame('message.received', INBOUND_FRAME);

    latestFakeSocket().message(frame);
    latestFakeSocket().message(frame); // duplicate re-delivery

    expect(listRowSnapshot()).toEqual({ preview: 'fresh inbound body', unread: 3 });
    expect(messages.listSnapshot(CONVERSATION_ID)?.data?.messages).toHaveLength(2);
  });

  it('never touches an unloaded conversation (parity: cache-patch only)', () => {
    latestFakeSocket().message(
      wsFrame('message.received', { ...INBOUND_FRAME, conversationId: OTHER_CONVERSATION_ID }),
    );

    expect(messages.listSnapshot(OTHER_CONVERSATION_ID)?.data).toBeUndefined();
  });

  it('patches the row status on message.sent / message.failed (still invalidates lists)', async () => {
    await loadInboxList();
    const lists = vi.spyOn(conversations, 'invalidateLists');
    const existingId = '00000000-0000-0000-0000-000000000001';

    latestFakeSocket().message(
      wsFrame('message.failed', {
        messageId: existingId,
        conversationId: CONVERSATION_ID,
        status: 'failed',
        error: 'delivery timeout',
        retryAt: '2026-10-18T00:01:00Z',
        attempt: 2,
      }),
    );
    let snapshot = messages.listSnapshot(CONVERSATION_ID)?.data;
    expect(snapshot?.messages.find((message) => message.id === existingId)?.status).toBe('failed');

    latestFakeSocket().message(
      wsFrame('message.sent', {
        messageId: existingId,
        conversationId: CONVERSATION_ID,
        status: 'sent',
        sentAt: '2026-10-18T00:02:00Z',
      }),
    );
    snapshot = messages.listSnapshot(CONVERSATION_ID)?.data;
    expect(snapshot?.messages.find((message) => message.id === existingId)?.status).toBe('sent');
    expect(lists).toHaveBeenCalledTimes(2);
  });

  it('drops channel-contract violations without touching the store', () => {
    latestFakeSocket().message(
      wsFrame('message.failed', {
        messageId: '00000000-0000-0000-0000-000000000001',
        conversationId: CONVERSATION_ID,
        status: 'failed',
        error: 'x',
        retryAt: '2026-10-18T00:01:00Z',
        attempt: 9, // frozen schema caps attempt at 3
      }),
    );

    const snapshot = messages.listSnapshot(CONVERSATION_ID)?.data;
    expect(snapshot?.messages.find((message) => message.id === '00000000-0000-0000-0000-000000000001')?.status).toBe('sent');
  });
});
