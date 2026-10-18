import { Component, inject, input, signal } from '@angular/core';

import type { ConversationDetail } from '../../contracts/http/conversations.schema';
import type { Note } from '../../contracts/http/notes.schema';
import { NotesStore } from '../../services/notes.store';

/**
 * Notes Section (the React `RightPanel/NotesSection` port — W9): shows the
 * current conversation's notes and the add-note form.
 *
 * @mention handling is server-side (regex `@(\w+)` on the note body);
 * there is no client-side suggestion UI (Phase-1 MVP parity — the users
 * API was deferred). The `notification.received` push on note create is
 * declared but never emitted server-side (F7/U1) — parity of absence,
 * not claimed as covered.
 *
 * Notes are read from `NotesStore` scoped to the current conversation;
 * `addNote` appends through the store (single write path — the store
 * updates the cached list, no extra invalidation).
 */
@Component({
  selector: 'app-notes-section',
  templateUrl: './notes-section.html',
})
export class NotesSection {
  private readonly notesStore = inject(NotesStore);

  readonly conversation = input.required<ConversationDetail>();

  protected readonly noteBody = signal('');
  protected readonly savingNote = signal(false);

  // Store snapshot reads stay at template-evaluation time (see TagsSection):
  // the notes entry is created by `fetchNotes()` inside the parent's effect,
  // so the read must re-run on every change detection.
  protected get notes(): Note[] {
    return this.notesStore.snapshot(this.conversation().id)?.data?.data ?? [];
  }

  protected get isLoading(): boolean {
    return this.notesStore.snapshot(this.conversation().id)?.loading ?? false;
  }

  protected async addNote(): Promise<void> {
    if (this.noteBody().trim().length === 0 || this.savingNote()) {
      return;
    }
    this.savingNote.set(true);
    try {
      await this.notesStore.addNote(this.conversation().id, this.noteBody());
      this.noteBody.set('');
    } catch {
      // React mutation-state parity: note failures carry no inline error UI.
    } finally {
      this.savingNote.set(false);
    }
  }

  protected onBodyInput(event: Event): void {
    this.noteBody.set((event.target as HTMLTextAreaElement).value);
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
