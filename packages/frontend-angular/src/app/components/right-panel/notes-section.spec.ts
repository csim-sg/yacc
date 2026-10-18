import { ComponentFixture, TestBed } from '@angular/core/testing';
import { flushTasks } from '../../../testing/flush-tasks';
import type { ConversationDetail } from '../../contracts/http/conversations.schema';
import type { ListNotesResponse, Note } from '../../contracts/http/notes.schema';
import type { ResourceSnapshot } from '../../services/resource-state';
import { NotesStore } from '../../services/notes.store';
import { NotesSection } from './notes-section';

/**
 * NotesSection spec (W9): the add-note form writes through `NotesStore`
 * (single write path) and clears on success; notes render with author,
 * body, date, and @mention badges. `notification.received` is not
 * exercised anywhere — it is never emitted server-side (F7/U1,
 * parity of absence).
 */
describe('NotesSection', () => {
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
    tags: [],
  };

  const note: Note = {
    id: '22222222-2222-2222-2222-222222222222',
    conversationId: conversation.id,
    authorId: '33333333-3333-3333-3333-333333333333',
    body: 'Investigating with @alice',
    mentions: ['alice'],
    createdAt: '2026-10-18T10:00:00',
    updatedAt: '2026-10-18T10:00:00',
  };

  interface NotesStoreDouble {
    snapshot: ReturnType<typeof vi.fn<(conversationId: string) => ResourceSnapshot<ListNotesResponse> | undefined>>;
    fetchNotes: ReturnType<typeof vi.fn<(conversationId: string) => Promise<void>>>;
    addNote: ReturnType<typeof vi.fn<(conversationId: string, body: string) => Promise<Note>>>;
  }

  let fixture: ComponentFixture<NotesSection>;
  let store: NotesStoreDouble;

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

  function notesSnapshot(
    overrides: Partial<ResourceSnapshot<ListNotesResponse>> = {},
  ): ResourceSnapshot<ListNotesResponse> {
    return {
      data: { data: [note], page: 1, limit: 20, total: 1 },
      loading: false,
      refetching: false,
      error: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    store = {
      snapshot: vi.fn(() => undefined),
      fetchNotes: vi.fn(async () => {}),
      addNote: vi.fn(async () => note),
    };
    TestBed.configureTestingModule({
      imports: [NotesSection],
      providers: [{ provide: NotesStore, useValue: store }],
    });
    fixture = TestBed.createComponent(NotesSection);
    fixture.componentRef.setInput('conversation', conversation);
    fixture.detectChanges();
  });

  it('renders the empty state and the zero count badge when nothing is loaded', () => {
    expect(find('notes-section')).toBeTruthy();
    expect(find('no-notes-message')?.textContent).toContain('No notes yet');
    expect(textContent()).toContain('0');
  });

  it('renders notes with author, body, date, and @mention badges', () => {
    store.snapshot.mockReturnValue(notesSnapshot());
    fixture.detectChanges();

    expect(find('no-notes-message')).toBeNull();
    expect(find(`note-item-${note.id}`)).toBeTruthy();
    expect(textContent()).toContain(note.authorId);
    expect(textContent()).toContain('Investigating with @alice');
    expect(find('note-mention-alice')?.textContent?.trim()).toBe('@alice');
  });

  it('shows the loading spinner on first load', () => {
    store.snapshot.mockReturnValue(notesSnapshot({ data: undefined, loading: true }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.loading')).toBeTruthy();
    expect(find('no-notes-message')).toBeNull();
  });

  it('adds a note through the store and clears the input on success', async () => {
    // The empty-body guard rejects direct invocation (double-guard parity
    // with React's disabled binding).
    await (fixture.componentInstance as unknown as { addNote: () => Promise<void> }).addNote();
    expect(store.addNote).not.toHaveBeenCalled();

    const input = find('note-input') as HTMLTextAreaElement;
    input.value = 'Follow up tomorrow';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button('save-note-button').disabled).toBe(false);

    button('save-note-button').click();
    await flushTasks();
    fixture.detectChanges();

    expect(store.addNote).toHaveBeenCalledWith(conversation.id, 'Follow up tomorrow');
    expect((find('note-input') as HTMLTextAreaElement).value).toBe('');
    expect(button('save-note-button').disabled).toBe(true);
  });

  it('keeps the input text on add failure with no error UI (React parity)', async () => {
    store.snapshot.mockReturnValue(notesSnapshot());
    store.addNote.mockRejectedValue(new Error('500'));
    fixture.detectChanges();

    const input = find('note-input') as HTMLTextAreaElement;
    input.value = 'Failing note';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('save-note-button').click();
    await flushTasks();
    fixture.detectChanges();

    expect((find('note-input') as HTMLTextAreaElement).value).toBe('Failing note');
    expect(textContent()).not.toContain('Saving...');
  });

  it('shows the saving state while the note request is in flight', async () => {
    let resolveAdd: ((value: Note) => void) | undefined;
    store.addNote.mockImplementation(
      () =>
        new Promise<Note>((resolve) => {
          resolveAdd = resolve;
        }),
    );

    const input = find('note-input') as HTMLTextAreaElement;
    input.value = 'In progress';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button('save-note-button').click();
    fixture.detectChanges();

    expect(textContent()).toContain('Saving...');
    expect((find('note-input') as HTMLTextAreaElement).disabled).toBe(true);

    resolveAdd?.(note);
    await flushTasks();
    fixture.detectChanges();
    expect(textContent()).not.toContain('Saving...');
  });
});
