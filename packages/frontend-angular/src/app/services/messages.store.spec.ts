import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { ListMessagesResponse, Message } from '../contracts/http/messages.schema';
import { flushTasks } from '../../testing/flush-tasks';
import { ConversationsStore } from './conversations.store';
import { MessagesStore } from './messages.store';

/**
 * MessagesStore spec (AC-ANG-005-1/2; T2 §3.1): family endpoints, the B4
 * send/retry invalidation mapping, and the FULL optimistic mechanism
 * (pending → reconcile / fail / remove / dedup) — tested-but-inactive per
 * U5.
 */
describe('MessagesStore', () => {
  let store: MessagesStore;
  let conversations: ConversationsStore;
  let http: HttpTestingController;

  const conversationList = { data: [], page: 1, limit: 20, total: 0 };
  const messageList: ListMessagesResponse = {
    messages: [message('m1', 'hello')],
    total: 1,
    page: 1,
    limit: 50,
  };

  function message(id: string, body: string, status: Message['status'] = 'sent'): Message {
    return {
      id,
      conversationId: 'c1',
      senderId: null,
      senderName: 'Operator',
      body,
      status,
      direction: 'outbound',
      createdAt: '2026-10-18T00:00:00',
      updatedAt: '2026-10-18T00:00:00',
    };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    });
    store = TestBed.inject(MessagesStore);
    conversations = TestBed.inject(ConversationsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function loadList(): Promise<void> {
    const pending = store.loadMessages('c1');
    http.expectOne('/api/conversations/c1/messages').flush(messageList);
    await pending;
    const conversationsPending = conversations.loadList({});
    http.expectOne('/api/conversations').flush(conversationList);
    await conversationsPending;
  }

  it('loads the conversation message list (verified wire shape)', async () => {
    await loadList();

    const snapshot = store.listSnapshot('c1');
    expect(snapshot?.data?.messages).toHaveLength(1);
    expect(snapshot?.data?.total).toBe(1);
  });

  it('send appends the confirmed message and invalidates the conversations family', async () => {
    await loadList();

    const pending = store.send('c1', { body: 'new reply' });
    const request = http.expectOne('/api/conversations/c1/messages');
    expect(request.request.body).toEqual({ body: 'new reply' });
    request.flush(message('m2', 'new reply'));
    await pending;

    const messages = store.listSnapshot('c1')?.data?.messages ?? [];
    expect(messages.map((row) => row.body)).toEqual(['hello', 'new reply']);
    expect(store.exists('c1', 'm2')).toBe(true);

    // B4: conversations invalidated — the next load refetches.
    const refetch = conversations.loadList({});
    http.expectOne('/api/conversations').flush(conversationList);
    await refetch;
  });

  it('retryMessage patches the message in place and invalidates conversations', async () => {
    await loadList();

    const pending = store.retryMessage('c1', 'm1');
    const request = http.expectOne('/api/conversations/c1/messages/m1/retry');
    request.flush({ data: message('m1', 'hello', 'sent') });
    await pending;

    expect(store.listSnapshot('c1')?.data?.messages[0]?.status).toBe('sent');
    const refetch = conversations.loadList({});
    http.expectOne('/api/conversations').flush(conversationList);
    await refetch;
  });

  it('optimistic mechanism: sendPending → reconcile replaces the temp row exactly once', async () => {
    await loadList();

    const tempId = store.sendPending('c1', { body: 'draft', senderName: 'Operator' });
    expect(tempId).toMatch(/^temp-/);
    expect(store.exists('c1', tempId)).toBe(true);

    const confirmed = message('m9', 'draft');
    store.reconcile('c1', tempId, confirmed);

    const messages = store.listSnapshot('c1')?.data?.messages ?? [];
    expect(messages).toHaveLength(2); // m1 + reconciled m9, no temp row
    expect(messages.some((row) => row.id === tempId)).toBe(false);
    expect(messages.some((row) => row.id === 'm9')).toBe(true);
  });

  it('optimistic mechanism: reconcile dedups when the server row already arrived', async () => {
    await loadList();

    const tempId = store.sendPending('c1', { body: 'draft', senderName: 'Operator' });
    store.reconcile('c1', 'm9', message('m9', 'draft'));

    store.reconcile('c1', tempId, message('m9', 'draft'));

    const messages = store.listSnapshot('c1')?.data?.messages ?? [];
    expect(messages.filter((row) => row.id === 'm9')).toHaveLength(1);
  });

  it('optimistic mechanism: fail rolls the temp row to failed, remove drops it', async () => {
    await loadList();

    const tempId = store.sendPending('c1', { body: 'draft', senderName: 'Operator' });

    store.fail('c1', tempId);
    expect(store.listSnapshot('c1')?.data?.messages.find((row) => row.id === tempId)?.status).toBe('failed');

    store.remove('c1', tempId);
    expect(store.exists('c1', tempId)).toBe(false);
  });

  it('errors on load land in the snapshot, not a thrown rejection', async () => {
    const pending = store.loadMessages('c1');
    http.expectOne('/api/conversations/c1/messages').flush({ error: 'boom' }, { status: 500, statusText: 'err' });
    await pending;
    await flushTasks();

    expect(store.listSnapshot('c1')?.error).toBeDefined();
  });
});
