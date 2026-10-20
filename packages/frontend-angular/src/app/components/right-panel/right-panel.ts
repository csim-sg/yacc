import { Component, effect, inject, input, output } from '@angular/core';

import type { ConversationDetail } from '../../contracts/http/conversations.schema';
import { NotesStore } from '../../services/notes.store';
import { TagsStore } from '../../services/tags.store';
import { AssignmentSection } from './assignment-section';
import { NotesSection } from './notes-section';
import { TagsSection } from './tags-section';

/**
 * Right Panel (the React `RightPanel` port — W8/W9/W10 surface): shows a
 * conversation's assignment, tags, and notes beside the conversation view.
 *
 * Loads the tag list and the current conversation's notes whenever the
 * conversation changes (React `useEffect` on `conversation.id` parity).
 * Mutations invalidate the caches inside the stores (single write path,
 * B4 mapping); the `tagsChange`/`assignmentChange` outputs carry the
 * page-level refetch intent exactly like the React `onTagsChange`/
 * `onAssignmentChange` props the conversation page consumes.
 */
@Component({
  selector: 'app-right-panel',
  imports: [AssignmentSection, NotesSection, TagsSection],
  templateUrl: './right-panel.html',
})
export class RightPanel {
  private readonly tagsStore = inject(TagsStore);
  private readonly notesStore = inject(NotesStore);

  /** The conversation whose details are shown. */
  readonly conversation = input.required<ConversationDetail>();
  /** Emitted after a tags change (React `onTagsChange` parity). */
  readonly tagsChange = output<void>();
  /** Emitted after an assignment change (React `onAssignmentChange` parity). */
  readonly assignmentChange = output<void>();

  constructor() {
    // Load tags + notes when the conversation changes; errors land in the
    // stores' snapshots (the sections render them).
    effect(() => {
      const conversationId = this.conversation().id;
      void this.tagsStore.fetchTags();
      void this.notesStore.fetchNotes(conversationId);
    });
  }
}
