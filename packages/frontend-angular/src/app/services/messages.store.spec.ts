import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { ListMessagesResponse, Message } from '../contracts/http/messages.schema';
import { flushTasks } from '../../testing/flush-tasks';
import { ConversationsStore } from './conversations.store';
import { MessagesStore } from './messages.store';

/**
 * MessagesStore spec (AC-ANG-005-1/2; T2 §3.1): family endpoints, the B4
 * send/retry invalidation mapping, the FULL optimistic mechanism
 * (pending → reconcile / fail / remove / dedup) — ACTIVATED on the live
 * send path by founder-authorized #499 (AC-4): pending row before the
 * POST, race-safe reconcile to the returned server row (tempId as a
 * secondary key), id-agnostic idempotent status patches, and the
 * bounded inbound re-delivery window (AC-5).
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
    // Frozen `{ data: Message }` send envelope (ANG-008 U3 disposition —
    // the service unwraps it; the store appends the confirmed row).
    request.flush({ data: message('m2', 'new reply') });
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

  // ---------------------------------------------------------------------------
  // U5 ACTIVATED on the live send path (AC-4, #499)
  // ---------------------------------------------------------------------------

  it('send appends the pending row BEFORE the POST and reconciles it to the server row', async () => {
    await loadList();

    const pending = store.send('c1', { body: 'new reply' });
    const request = http.expectOne('/api/conversations/c1/messages');

    // Pre-POST: exactly one pending row keyed by its temp id.
    const before = store.listSnapshot('c1')?.data?.messages ?? [];
    expect(before.filter((row) => row.status === 'pending')).toHaveLength(1);
    const tempRow = before.find((row) => row.status === 'pending');
    expect(tempRow?.id).toMatch(/^temp-/);
    expect(tempRow?.body).toBe('new reply');

    // The 201 returns the PENDING server message — the row is reconciled
    // to the server id: temp row count 0, exactly one row for the body.
    request.flush({ data: message('srv-1', 'new reply', 'pending') });
    await pending;

    // B4 mapping rides the send: flush the conversations-family refetch.
    http.expectOne('/api/conversations').flush(conversationList);

    const after = store.listSnapshot('c1')?.data?.messages ?? [];
    expect(after.filter((row) => row.id === tempRow?.id)).toHaveLength(0);
    expect(after.filter((row) => row.body === 'new reply')).toHaveLength(1);
    expect(after.find((row) => row.id === 'srv-1')?.status).toBe('pending');
    expect(store.exists('c1', 'srv-1')).toBe(true);
  });

  it('status patches match the server id AND the reconciled tempId (secondary key)', async () => {
    await loadList();

    const pending = store.send('c1', { body: 'new reply' });
    const request = http.expectOne('/api/conversations/c1/messages');
    // Capture the optimistic row's tempId from the pre-POST state.
    const tempId = (store.listSnapshot('c1')?.data?.messages ?? []).find(
      (row) => row.status === 'pending',
    )?.id as string;
    request.flush({ data: message('srv-1', 'new reply', 'pending') });
    await pending;
    http.expectOne('/api/conversations').flush(conversationList); // B4 refetch

    // By server id.
    store.updateMessageStatus('c1', 'srv-1', 'sent');
    expect(store.listSnapshot('c1')?.data?.messages.find((row) => row.id === 'srv-1')?.status).toBe('sent');

    // By the tempId of the same (already reconciled) row — the secondary
    // key recorded at reconcile.
    store.updateMessageStatus('c1', tempId, 'failed');
    expect(store.listSnapshot('c1')?.data?.messages.find((row) => row.id === 'srv-1')?.status).toBe('failed');
  });

  it('duplicate status frames apply once (idempotent, never duplicate rows)', async () => {
    await loadList();

    const pending = store.send('c1', { body: 'new reply' });
    const request = http.expectOne('/api/conversations/c1/messages');
    request.flush({ data: message('srv-1', 'new reply', 'pending') });
    await pending;
    http.expectOne('/api/conversations').flush(conversationList); // B4 refetch

    store.updateMessageStatus('c1', 'srv-1', 'sent');
    store.updateMessageStatus('c1', 'srv-1', 'sent');

    const rows = store.listSnapshot('c1')?.data?.messages ?? [];
    expect(rows.filter((row) => row.body === 'new reply')).toHaveLength(1);
    expect(rows.find((row) => row.id === 'srv-1')?.status).toBe('sent');
  });

  it('a status frame that races the reconcile keeps one row and is not regressed', async () => {
    await loadList();

    const tempId = store.sendPending('c1', { body: 'draft', senderName: 'Operator' });

    // The `message.sent` frame references the tempId BEFORE the 201
    // resolves (the pre-reconcile row's own id).
    store.updateMessageStatus('c1', tempId, 'sent');
    expect(store.listSnapshot('c1')?.data?.messages.find((row) => row.id === tempId)?.status).toBe('sent');

    // The late reconcile replaces the temp row with the server row —
    // exactly one row, and the applied `sent` status is preserved.
    store.reconcile('c1', tempId, message('srv-2', 'draft', 'pending'));

    const rows = store.listSnapshot('c1')?.data?.messages ?? [];
    expect(rows.filter((row) => row.body === 'draft')).toHaveLength(1);
    expect(rows.some((row) => row.id === tempId)).toBe(false);
    expect(rows.find((row) => row.id === 'srv-2')?.status).toBe('sent');
  });

  it('send failure rolls the pending row to failed and rethrows (no server id invented)', async () => {
    await loadList();

    const failing = store.send('c1', { body: 'will fail' });
    const request = http.expectOne('/api/conversations/c1/messages');
    request.flush({ error: 'boom' }, { status: 500, statusText: 'err' });
    await expect(failing).rejects.toBeDefined();

    const rows = store.listSnapshot('c1')?.data?.messages ?? [];
    const failedRow = rows.find((row) => row.body === 'will fail');
    expect(failedRow?.status).toBe('failed');
    expect(failedRow?.id).toMatch(/^temp-/); // never an invented server id
  });

  it('receiveInbound answers first-delivery across the bounded re-delivery window (AC-5)', async () => {
    await loadList();

    const inbound = message('in-1', 'hello', 'sent');
    inbound.direction = 'inbound';
    expect(store.receiveInbound(inbound)).toBe(true); // first delivery → appended
    expect(store.receiveInbound(inbound)).toBe(false); // re-delivery → dedup

    // An unloaded conversation still answers the dedup (no cache row).
    const elsewhere = message('in-2', 'hi', 'sent');
    elsewhere.conversationId = 'unloaded';
    elsewhere.direction = 'inbound';
    expect(store.receiveInbound(elsewhere)).toBe(true);
    expect(store.receiveInbound(elsewhere)).toBe(false);
    expect(store.listSnapshot('unloaded')?.data).toBeUndefined();
  });

  it('errors on load land in the snapshot, not a thrown rejection', async () => {
    const pending = store.loadMessages('c1');
    http.expectOne('/api/conversations/c1/messages').flush({ error: 'boom' }, { status: 500, statusText: 'err' });
    await pending;
    await flushTasks();

    expect(store.listSnapshot('c1')?.error).toBeDefined();
  });
});
