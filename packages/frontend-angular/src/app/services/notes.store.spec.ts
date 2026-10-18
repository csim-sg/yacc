import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NotesStore } from './notes.store';

/**
 * NotesStore spec (AC-ANG-005-2; T2 §3.2 `notes.store` row): per-
 * conversation notes scoped by the current-conversation signal; addNote
 * appends to the cached list.
 */
describe('NotesStore', () => {
  let store: NotesStore;
  let http: HttpTestingController;

  const note = {
    id: 'n1',
    conversationId: 'c1',
    authorId: 'u1',
    body: 'keep an eye on this',
    mentions: [],
    createdAt: '2026-10-18T00:00:00',
    updatedAt: '2026-10-18T00:00:00',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    });
    store = TestBed.inject(NotesStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetches notes for a conversation and tracks it as the current context', async () => {
    const pending = store.fetchNotes('c1');
    http.expectOne('/api/conversations/c1/notes').flush({ data: [note], page: 1, pageSize: 20, total: 1 });
    await pending;

    expect(store.currentConversationId()).toBe('c1');
    expect(store.snapshot('c1')?.data?.data).toEqual([note]);
  });

  it('addNote posts and appends the created note', async () => {
    const load = store.fetchNotes('c1');
    http.expectOne('/api/conversations/c1/notes').flush({ data: [], page: 1, pageSize: 20, total: 0 });
    await load;

    const pending = store.addNote('c1', 'keep an eye on this');
    const request = http.expectOne('/api/conversations/c1/notes');
    expect(request.request.body).toEqual({ body: 'keep an eye on this' });
    request.flush({ data: note });
    await pending;

    expect(store.snapshot('c1')?.data?.data).toEqual([note]);
  });

  it('switching conversations loads the other key; setCurrentConversation only moves the context', async () => {
    const loadFirst = store.fetchNotes('c1');
    http.expectOne('/api/conversations/c1/notes').flush({ data: [note], page: 1, pageSize: 20, total: 1 });
    await loadFirst;

    store.setCurrentConversation('c2');
    expect(store.currentConversationId()).toBe('c2');
    expect(store.snapshot('c2')).toBeUndefined();

    const loadSecond = store.fetchNotes('c2');
    http.expectOne('/api/conversations/c2/notes').flush({ data: [], page: 1, pageSize: 20, total: 0 });
    await loadSecond;
    expect(store.snapshot('c1')?.data?.data).toEqual([note]);
    expect(store.snapshot('c2')?.data?.data).toEqual([]);
  });

  it('fetch failures land in the snapshot error field', async () => {
    const pending = store.fetchNotes('c1');
    http.expectOne('/api/conversations/c1/notes').flush({ error: 'boom' }, { status: 500, statusText: 'err' });
    await pending;

    expect(store.snapshot('c1')?.error).toBeDefined();
  });
});
