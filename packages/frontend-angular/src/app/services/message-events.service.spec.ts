import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';

import { ConversationsStore } from './conversations.store';
import { MessagesStore } from './messages.store';
import { MessagesService } from './messages.service';
import { WS_SOCKET_FACTORY, WebSocketClientService } from './websocket-client.service';
import {
  FakeRealtimeSocket,
  latestFakeSocket,
  resetFakeSockets,
  wsFrame,
} from '../../test/ws-test-socket';
import { MessageEventsService } from './message-events.service';

/**
 * MessageEventsService spec (AC-ANG-006-3 handler wiring): the frozen
 * `message.*` channels write the ANG-005 messages store — append with
 * id dedup for `message.received`, status patches for `message.sent` /
 * `message.failed` — and invalidate the conversations lists (React
 * handler parity).
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

describe('MessageEventsService', () => {
  let service: MessageEventsService;
  let client: WebSocketClientService;
  let messages: MessagesStore;
  let conversations: ConversationsStore;
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

    // Seed the conversation's message-list cache through the store (the
    // HTTP service is spied — no HttpClient wiring is needed).
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
  });

  it('appends an inbound message.received row and invalidates the lists', () => {
    const lists = vi.spyOn(conversations, 'invalidateLists');

    latestFakeSocket().message(
      wsFrame('message.received', {
        messageId: MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        platform: 'irc',
        senderId: 'irc-nick',
        senderName: 'Bob',
        body: 'hello from IRC',
        timestamp: '2026-10-18T00:01:00Z',
      }),
    );

    const snapshot = messages.listSnapshot(CONVERSATION_ID)?.data;
    expect(snapshot?.messages).toHaveLength(2);
    expect(snapshot?.total).toBe(2);
    expect(snapshot?.messages.at(-1)).toMatchObject({
      id: MESSAGE_ID,
      direction: 'inbound',
      status: 'sent',
      createdAt: '2026-10-18T00:01:00Z',
    });
    expect(lists).toHaveBeenCalledTimes(1);
  });

  it('dedups message.received rows (backlog replay re-delivery)', () => {
    const inbound = wsFrame('message.received', {
      messageId: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      platform: 'irc',
      senderId: 'irc-nick',
      senderName: 'Bob',
      body: 'hello from IRC',
      timestamp: '2026-10-18T00:01:00Z',
    });

    latestFakeSocket().message(inbound);
    latestFakeSocket().message(inbound);

    const snapshot = messages.listSnapshot(CONVERSATION_ID)?.data;
    expect(snapshot?.messages).toHaveLength(2);
    expect(snapshot?.total).toBe(2);
  });

  it('never touches an unloaded conversation (parity: cache-patch only)', () => {
    latestFakeSocket().message(
      wsFrame('message.received', {
        messageId: MESSAGE_ID,
        conversationId: OTHER_CONVERSATION_ID,
        platform: 'telegram',
        senderId: 'tg-1',
        senderName: 'Carol',
        body: 'hi',
        timestamp: '2026-10-18T00:01:00Z',
      }),
    );

    expect(messages.listSnapshot(OTHER_CONVERSATION_ID)?.data).toBeUndefined();
  });

  it('patches the row status on message.sent / message.failed', () => {
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
