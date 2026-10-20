import { Injectable, signal, inject } from '@angular/core';

import { cacheKeys } from '../contracts/cache-keys';
import type { Note } from '../contracts/http/notes.schema';
import type { ListNotesResponse } from '../contracts/http/notes.schema';
import { NotesService } from './notes.service';
import { ResourceState, type ResourceSnapshot } from './resource-state';

/**
 * Notes resource store (T2 §3.2 `notes.store` row): notes for the current
 * conversation, on `ResourceState<T>` — one state location for list +
 * add, scoped by the current-conversation signal.
 */
@Injectable({ providedIn: 'root' })
export class NotesStore {
  private readonly service = inject(NotesService);
  private readonly state = new ResourceState<ListNotesResponse>();

  private readonly currentId = signal<string | null>(null);
  /** The conversation whose notes are in context (null = none). */
  readonly currentConversationId = this.currentId.asReadonly();

  /** Reactive snapshot of one conversation's notes, if loaded. */
  snapshot(conversationId: string): ResourceSnapshot<ListNotesResponse> | undefined {
    return this.state.snapshot(cacheKeys.conversations.notes(conversationId));
  }

  /**
   * Load (or refresh) a conversation's notes and make it the current
   * context (error lands in state).
   */
  async fetchNotes(conversationId: string): Promise<void> {
    this.currentId.set(conversationId);
    try {
      await this.state.load(
        cacheKeys.conversations.notes(conversationId),
        () => this.service.list(conversationId),
      );
    } catch {
      // State carries the error.
    }
  }

  /** POST .../notes — appends the created note to the cached list. */
  async addNote(conversationId: string, body: string): Promise<Note> {
    const response = await this.service.create(conversationId, { body });
    const created = response.data;
    this.state.update(cacheKeys.conversations.notes(conversationId), (previous) =>
      previous ? { ...previous, data: [...previous.data, created] } : previous,
    );
    return created;
  }

  /** Switch the current-notes context (per-key state needs no reset). */
  setCurrentConversation(conversationId: string | null): void {
    this.currentId.set(conversationId);
  }
}
