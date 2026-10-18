import { ComponentFixture, TestBed } from '@angular/core/testing';
import { flushTasks } from '../../../testing/flush-tasks';
import type { ConversationDetail } from '../../contracts/http/conversations.schema';
import type { ListTagsResponse, Tag } from '../../contracts/http/tags.schema';
import type { ResourceSnapshot } from '../../services/resource-state';
import { TagsStore } from '../../services/tags.store';
import { TagsSection } from './tags-section';

/**
 * TagsSection spec (W8): renders the conversation's tags, attaches/detaches
 * through `TagsStore` (the single write path — invalidation is store-owned),
 * and the create-new-tag form auto-attaches the created tag. The `change`
 * output carries the page-level refetch intent (React `onChange` parity).
 */
describe('TagsSection', () => {
  const conversation: ConversationDetail = {
    id: '11111111-1111-1111-1111-111111111111',
    channel: 'telegram',
    externalThreadId: 'thread-1',
    title: 'Support thread',
    status: 'open',
    priority: 'normal',
    assignedUserId: null,
    createdAt: '2026-10-18T00:00:00',
    updatedAt: '2026-10-18T00:00:00',
    tags: [{ id: '1', name: 'billing', color: '#FF6B6B' }],
  };

  const poolTag: Tag = {
    id: 2,
    name: 'urgent',
    color: '#4ECDC4',
    createdAt: '2026-10-18T00:00:00',
    createdBy: '00000000-0000-0000-0000-00000000aaaa',
  };

  interface TagsStoreDouble {
    snapshot: ReturnType<typeof vi.fn<() => ResourceSnapshot<ListTagsResponse> | undefined>>;
    fetchTags: ReturnType<typeof vi.fn<() => Promise<void>>>;
    createTag: ReturnType<typeof vi.fn<(name: string, color: string) => Promise<Tag>>>;
    attachToConversation: ReturnType<
      typeof vi.fn<(conversationId: string, tagId: number) => Promise<void>>
    >;
    removeFromConversation: ReturnType<
      typeof vi.fn<(conversationId: string, tagId: number) => Promise<void>>
    >;
  }

  let fixture: ComponentFixture<TagsSection>;
  let store: TagsStoreDouble;
  let changes: number[];

  function find(testid: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testid}"]`);
  }

  function button(testid: string): HTMLButtonElement {
    const element = find(testid);
    if (element === null) {
      throw new Error(`Missing [data-testid="${testid}"]`);
    }
    return element as HTMLButtonElement;
  }

  function textContent(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function tagsSnapshot(): ResourceSnapshot<ListTagsResponse> {
    return { data: { data: [poolTag] }, loading: false, refetching: false, error: null };
  }

  beforeEach(() => {
    store = {
      snapshot: vi.fn(() => undefined),
      fetchTags: vi.fn(async () => {}),
      createTag: vi.fn(async () => poolTag),
      attachToConversation: vi.fn(async () => {}),
      removeFromConversation: vi.fn(async () => {}),
    };
    TestBed.configureTestingModule({
      imports: [TagsSection],
      providers: [{ provide: TagsStore, useValue: store }],
    });
    fixture = TestBed.createComponent(TagsSection);
    fixture.componentRef.setInput('conversation', conversation);
    changes = [];
    fixture.componentInstance.change.subscribe(() => changes.push(changes.length));
    fixture.detectChanges();
  });

  it('renders the conversation tags as removable badges', () => {
    expect(find('tags-section')).toBeTruthy();
    expect(button('tag-badge-1').textContent).toContain('billing');
    expect(button('remove-tag-1').getAttribute('aria-label')).toBe('Remove billing tag');
  });

  it('lists available tags not yet on the conversation and attaches on pick', async () => {
    store.snapshot.mockReturnValue(tagsSnapshot());
    fixture.detectChanges();

    expect(button('add-tag-button')).toBeTruthy();
    expect(button('add-tag-option-2').textContent).toContain('urgent');

    button('add-tag-option-2').click();
    await flushTasks();
    fixture.detectChanges();

    expect(store.attachToConversation).toHaveBeenCalledWith(conversation.id, 2);
    expect(changes).toEqual([0]);
  });

  it('shows the adding hint while the attach request is in flight', async () => {
    store.snapshot.mockReturnValue(tagsSnapshot());
    let resolveAttach: (() => void) | undefined;
    store.attachToConversation.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveAttach = resolve;
        }),
    );
    fixture.detectChanges();

    // Double-submit while in flight: the re-entrancy guard drops the second call.
    button('add-tag-option-2').click();
    button('add-tag-option-2').click();
    fixture.detectChanges();
    expect(textContent()).toContain('Adding tag...');

    resolveAttach?.();
    await flushTasks();
    fixture.detectChanges();
    expect(textContent()).not.toContain('Adding tag...');
    expect(store.attachToConversation).toHaveBeenCalledTimes(1);
  });

  it('detaches through the store with the numeric tag id', async () => {
    let resolveDetach: (() => void) | undefined;
    store.removeFromConversation.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDetach = resolve;
        }),
    );

    button('remove-tag-1').click();
    button('remove-tag-1').click(); // re-entrancy guard drops the second call
    fixture.detectChanges();
    expect(store.removeFromConversation).toHaveBeenCalledTimes(1);
    expect(store.removeFromConversation).toHaveBeenCalledWith(conversation.id, 1);
    expect(textContent()).toContain('Removing tag...');

    resolveDetach?.();
    await flushTasks();
    fixture.detectChanges();
    expect(changes).toEqual([0]);
    expect(textContent()).not.toContain('Removing tag...');
  });

  it('swallows attach failures: no error UI, change not emitted (React mutation-state parity)', async () => {
    store.snapshot.mockReturnValue(tagsSnapshot());
    store.attachToConversation.mockRejectedValue(new Error('400'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    fixture.detectChanges();

    button('add-tag-option-2').click();
    await flushTasks();
    fixture.detectChanges();

    expect(changes).toEqual([]);
    expect(textContent()).not.toContain('Adding tag...');
    expect(find('create-tag-form')).toBeNull();
    consoleError.mockRestore();
  });

  it('opens the create form, creates the tag and auto-attaches it', async () => {
    store.snapshot.mockReturnValue(tagsSnapshot());
    fixture.detectChanges();

    expect(find('create-tag-form')).toBeNull(); // form hidden before opening
    button('create-new-tag-button').click();
    fixture.detectChanges();
    expect(find('create-tag-form')).toBeTruthy();

    expect(button('save-tag-button').disabled).toBe(true); // empty name

    // The empty-name guard also rejects direct invocation (double-guard parity
    // with React's disabled binding).
    await (fixture.componentInstance as unknown as { createTag: () => Promise<void> }).createTag();
    expect(store.createTag).not.toHaveBeenCalled();

    const nameInput = find('tag-name-input') as HTMLInputElement;
    nameInput.value = 'follow-up';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button('save-tag-button').disabled).toBe(false);

    // Pick a non-default color, then create.
    button('color-option-#BB8FCE').click();
    button('save-tag-button').click();
    await flushTasks();
    fixture.detectChanges();

    expect(store.createTag).toHaveBeenCalledWith('follow-up', '#BB8FCE');
    expect(store.attachToConversation).toHaveBeenCalledWith(conversation.id, poolTag.id);
    expect(find('create-tag-form')).toBeNull(); // form closed after create
    expect(changes).toEqual([0]);
  });

  it('closes the create form on cancel without creating', () => {
    store.snapshot.mockReturnValue(tagsSnapshot());
    fixture.detectChanges();

    button('create-new-tag-button').click();
    fixture.detectChanges();
    button('cancel-tag-button').click();
    fixture.detectChanges();

    expect(store.createTag).not.toHaveBeenCalled();
    expect(find('create-tag-form')).toBeNull();
  });
});
