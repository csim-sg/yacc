import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TagsStore } from './tags.store';
import { ConversationsStore } from './conversations.store';

/**
 * TagsStore spec (AC-ANG-005-2; T2 §3.2 `tags.store` row): the store IS
 * the resource store — list + CRUD in one state location; attach/detach
 * invalidate the conversations family (B4).
 */
describe('TagsStore', () => {
  let store: TagsStore;
  let conversations: ConversationsStore;
  let http: HttpTestingController;

  const tag = { id: 1, name: 'billing', color: '#ff0000', createdAt: '2026-10-18T00:00:00', createdBy: 'u1' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([])), provideHttpClientTesting()],
    });
    store = TestBed.inject(TagsStore);
    conversations = TestBed.inject(ConversationsStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function flushConversations(): void {
    http.expectOne('/api/conversations').flush({ data: [], page: 1, limit: 20, total: 0 });
  }

  it('fetches the tag list and serves a cache hit afterwards', async () => {
    const first = store.fetchTags();
    http.expectOne('/api/tags').flush({ data: [tag] });
    await first;

    expect(store.snapshot()?.data?.data).toEqual([tag]);

    await store.fetchTags();
    http.expectNone('/api/tags');
  });

  it('create posts and appends the created tag to the cached list', async () => {
    const load = store.fetchTags();
    http.expectOne('/api/tags').flush({ data: [] });
    await load;

    const pending = store.createTag('billing', '#ff0000');
    const request = http.expectOne('/api/tags');
    expect(request.request.body).toEqual({ name: 'billing', color: '#ff0000' });
    request.flush({ data: tag });
    await pending;

    expect(store.snapshot()?.data?.data).toEqual([tag]);
  });

  it('attach and detach invalidate the conversations family', async () => {
    const load = conversations.loadList({});
    flushConversations();
    await load;

    const attach = store.attachToConversation('c1', 1);
    http.expectOne('/api/conversations/c1/tags').flush({ data: [] });
    await attach;
    // Invalidated → the next conversations load refetches.
    const refetchAfterAttach = conversations.loadList({});
    flushConversations();
    await refetchAfterAttach;

    const detach = store.removeFromConversation('c1', 1);
    http.expectOne('/api/conversations/c1/tags/1').flush(null);
    await detach;
    const refetchAfterDetach = conversations.loadList({});
    flushConversations();
    await refetchAfterDetach;
  });

  it('fetch failures land in the snapshot error field', async () => {
    const pending = store.fetchTags();
    http.expectOne('/api/tags').flush({ error: 'boom' }, { status: 500, statusText: 'err' });
    await pending;

    expect(store.snapshot()?.error).toBeDefined();
  });
});
