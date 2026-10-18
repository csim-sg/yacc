import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { flushTasks } from '../../../testing/flush-tasks';
import type { ConversationDetail } from '../../contracts/http/conversations.schema';
import type { ListNotesResponse, Note } from '../../contracts/http/notes.schema';
import type { ListTagsResponse, Tag } from '../../contracts/http/tags.schema';
import type { ResourceSnapshot } from '../../services/resource-state';
import { ConversationsStore } from '../../services/conversations.store';
import { NotesStore } from '../../services/notes.store';
import { TagsStore } from '../../services/tags.store';
import { AssignmentSection } from './assignment-section';
import { NotesSection } from './notes-section';
import { RightPanel } from './right-panel';
import { TagsSection } from './tags-section';

/**
 * RightPanel spec (W8/W9/W10 surface): composition of the assignment, tags,
 * and notes sections; loads the tag list + the conversation's notes when
 * the conversation changes; forwards the section `change` outputs as the
 * `tagsChange`/`assignmentChange` outputs consumed by #378's page.
 */
describe('RightPanel', () => {
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

  const note: Note = {
    id: '22222222-2222-2222-2222-222222222222',
    conversationId: conversation.id,
    authorId: '33333333-3333-3333-3333-333333333333',
    body: 'A note',
    mentions: [],
    createdAt: '2026-10-18T10:00:00',
    updatedAt: '2026-10-18T10:00:00',
  };

  interface StoresDouble {
    tags: {
      snapshot: ReturnType<typeof vi.fn<() => ResourceSnapshot<ListTagsResponse> | undefined>>;
      fetchTags: ReturnType<typeof vi.fn<() => Promise<void>>>;
      createTag: ReturnType<typeof vi.fn<(name: string, color: string) => Promise<Tag>>>;
      attachToConversation: ReturnType<
        typeof vi.fn<(conversationId: string, tagId: number) => Promise<void>>
      >;
      removeFromConversation: ReturnType<
        typeof vi.fn<(conversationId: string, tagId: number) => Promise<void>>
      >;
    };
    notes: {
      snapshot: ReturnType<
        typeof vi.fn<(conversationId: string) => ResourceSnapshot<ListNotesResponse> | undefined>
      >;
      fetchNotes: ReturnType<typeof vi.fn<(conversationId: string) => Promise<void>>>;
      addNote: ReturnType<typeof vi.fn<(conversationId: string, body: string) => Promise<Note>>>;
    };
    conversations: {
      assign: ReturnType<
        typeof vi.fn<(conversationId: string, assignedUserId: string) => Promise<void>>
      >;
    };
  }

  let fixture: ComponentFixture<RightPanel>;
  let stores: StoresDouble;

  function textContent(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    stores = {
      tags: {
        snapshot: vi.fn(() => undefined),
        fetchTags: vi.fn(async () => {}),
        createTag: vi.fn(async () => poolTag),
        attachToConversation: vi.fn(async () => {}),
        removeFromConversation: vi.fn(async () => {}),
      },
      notes: {
        snapshot: vi.fn(() => undefined),
        fetchNotes: vi.fn(async () => {}),
        addNote: vi.fn(async () => note),
      },
      conversations: {
        assign: vi.fn(async () => {}),
      },
    };
    TestBed.configureTestingModule({
      imports: [RightPanel],
      providers: [
        { provide: TagsStore, useValue: stores.tags },
        { provide: NotesStore, useValue: stores.notes },
        { provide: ConversationsStore, useValue: stores.conversations },
      ],
    });
    fixture = TestBed.createComponent(RightPanel);
    fixture.componentRef.setInput('conversation', conversation);
    fixture.detectChanges();
  });

  it('renders the details header and the three sections in order', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="right-panel"]')).toBeTruthy();
    expect(textContent()).toContain('Details');

    const order = el
      .querySelector('[data-testid="right-panel"] > div:last-child')
      ?.querySelectorAll('app-assignment-section, app-tags-section, app-notes-section');
    expect(order?.length).toBe(3);
    expect(order?.item(0).tagName).toBe('APP-ASSIGNMENT-SECTION');
    expect(order?.item(1).tagName).toBe('APP-TAGS-SECTION');
    expect(order?.item(2).tagName).toBe('APP-NOTES-SECTION');
  });

  it('loads the tag list and the conversation notes on init', () => {
    expect(stores.tags.fetchTags).toHaveBeenCalledTimes(1);
    expect(stores.notes.fetchNotes).toHaveBeenCalledTimes(1);
    expect(stores.notes.fetchNotes).toHaveBeenCalledWith(conversation.id);
  });

  it('reloads when the conversation changes', () => {
    const next: ConversationDetail = { ...conversation, id: '55555555-5555-5555-5555-555555555555' };
    fixture.componentRef.setInput('conversation', next);
    fixture.detectChanges();

    expect(stores.tags.fetchTags).toHaveBeenCalledTimes(2);
    expect(stores.notes.fetchNotes).toHaveBeenCalledTimes(2);
    expect(stores.notes.fetchNotes).toHaveBeenCalledWith(next.id);
  });

  it('forwards the tags section change as tagsChange', async () => {
    stores.tags.snapshot.mockReturnValue({
      data: { data: [poolTag] },
      loading: false,
      refetching: false,
      error: null,
    });
    fixture.detectChanges();

    const emitted: string[] = [];
    fixture.componentInstance.tagsChange.subscribe(() => emitted.push('tags'));

    const tagsSection = fixture.debugElement
      .query(By.directive(TagsSection))
      .injector.get(TagsSection);
    tagsSection.change.emit();

    expect(emitted).toEqual(['tags']);
  });

  it('forwards the assignment section change as assignmentChange', () => {
    const emitted: string[] = [];
    fixture.componentInstance.assignmentChange.subscribe(() => emitted.push('assignment'));

    const assignmentSection = fixture.debugElement
      .query(By.directive(AssignmentSection))
      .injector.get(AssignmentSection);
    assignmentSection.change.emit();

    expect(emitted).toEqual(['assignment']);
  });

  it('renders notes from the scoped notes snapshot', () => {
    stores.notes.snapshot.mockReturnValue({
      data: { data: [note], page: 1, limit: 20, total: 1 },
      loading: false,
      refetching: false,
      error: null,
    });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="note-item-${note.id}"]`),
    ).toBeTruthy();
  });

  it('detaches a tag end-to-end through the composed sections', async () => {
    const remove = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="remove-tag-1"]',
    ) as HTMLButtonElement;
    expect(remove).toBeTruthy();

    remove.click();
    await flushTasks();
    fixture.detectChanges();

    expect(stores.tags.removeFromConversation).toHaveBeenCalledWith(conversation.id, 1);
  });
});
