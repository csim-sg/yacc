import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';

import { ConversationsStore } from './conversations.store';
import { WS_SOCKET_FACTORY, WebSocketClientService } from './websocket-client.service';
import {
  FakeRealtimeSocket,
  latestFakeSocket,
  resetFakeSockets,
  wsFrame,
} from '../../test/ws-test-socket';
import { ConversationEventsService } from './conversation-events.service';

/**
 * ConversationEventsService spec (AC-ANG-006-3 handler wiring): the
 * frozen `conversation.*` channels invalidate the conversation detail +
 * conversations list caches (B4 mapping, React handler parity).
 */

const socketFactory = vi.fn((url: string) => new FakeRealtimeSocket(url));

const CONVERSATION_ID = '00000000-0000-0000-0000-00000000000c';

function updatedFrame(conversationId: string): string {
  return wsFrame('conversation.updated', {
    conversationId,
    updatedFields: { status: 'open' },
    changedBy: '00000000-0000-0000-0000-000000000004',
    changedAt: '2026-10-18T00:00:00Z',
  });
}

describe('ConversationEventsService', () => {
  let service: ConversationEventsService;
  let client: WebSocketClientService;
  let conversations: ConversationsStore;
  let binding: Subscription;

  beforeEach(() => {
    resetFakeSockets(socketFactory);
    TestBed.configureTestingModule({
      providers: [{ provide: WS_SOCKET_FACTORY, useValue: socketFactory }],
    });
    service = TestBed.inject(ConversationEventsService);
    client = TestBed.inject(WebSocketClientService);
    conversations = TestBed.inject(ConversationsStore);
    binding = service.bind();
    client.connect('token-1');
    latestFakeSocket().open();
  });

  afterEach(() => {
    binding.unsubscribe(); // listener teardown
    client.disconnect();
  });

  it('invalidates the detail + list caches on conversation.updated', () => {
    const detail = vi.spyOn(conversations, 'invalidateDetail');
    const lists = vi.spyOn(conversations, 'invalidateLists');

    latestFakeSocket().message(updatedFrame(CONVERSATION_ID));

    expect(detail).toHaveBeenCalledWith(CONVERSATION_ID);
    expect(lists).toHaveBeenCalledTimes(1);
  });

  it('invalidates detail + lists on conversation.reopened (U2: wire truth, no coverage claim)', () => {
    const detail = vi.spyOn(conversations, 'invalidateDetail');
    const lists = vi.spyOn(conversations, 'invalidateLists');

    latestFakeSocket().message(
      wsFrame('conversation.reopened', { conversationId: CONVERSATION_ID, reason: 'ticket' }),
    );

    expect(detail).toHaveBeenCalledWith(CONVERSATION_ID);
    expect(lists).toHaveBeenCalledTimes(1);
  });

  it('invalidates only the lists when the unpinned reopened payload has no conversationId', () => {
    const detail = vi.spyOn(conversations, 'invalidateDetail');
    const lists = vi.spyOn(conversations, 'invalidateLists');

    latestFakeSocket().message(wsFrame('conversation.reopened', { reason: 'ticket' }));

    expect(detail).not.toHaveBeenCalled();
    expect(lists).toHaveBeenCalledTimes(1);
  });
});
