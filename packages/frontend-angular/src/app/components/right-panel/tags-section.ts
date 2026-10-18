import { Component, inject, input, output, signal } from '@angular/core';

import type { ConversationDetail, ConversationTag } from '../../contracts/http/conversations.schema';
import type { Tag } from '../../contracts/http/tags.schema';
import { TagsStore } from '../../services/tags.store';

/** Palette offered when creating a tag (React `TAG_COLORS` port). */
export const TAG_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
] as const;

/**
 * Tags Section (the React `RightPanel/TagsSection` port — W8): renders the
 * conversation's tags and manages the tag list — attach/detach, plus the
 * create-new-tag form that auto-attaches the created tag.
 *
 * Attach/detach run through `TagsStore`, which invalidates the
 * conversations family (detail + list, B4) — the store is the single
 * write path; `change` carries the page-level refetch intent (React
 * `onChange` parity).
 */
@Component({
  selector: 'app-tags-section',
  templateUrl: './tags-section.html',
})
export class TagsSection {
  private readonly tagsStore = inject(TagsStore);

  readonly conversation = input.required<ConversationDetail>();
  /** Conversation detail changed upstream (React `onChange` parity). */
  readonly change = output<void>();

  protected readonly colors = TAG_COLORS;
  protected readonly showCreateForm = signal(false);
  protected readonly newTagName = signal('');
  protected readonly selectedColor = signal<string>(TAG_COLORS[0]);
  protected readonly addingTag = signal(false);
  protected readonly removingTag = signal(false);
  protected readonly creatingTag = signal(false);

  // Store snapshots are read at template-evaluation time (not via
  // `computed`): `ResourceState.snapshot()` reads the entry's signal only
  // when the entry exists, so the read must re-run on every change
  // detection until the entry is created by `fetchTags()`.
  protected get tags(): Tag[] {
    return this.tagsStore.snapshot()?.data?.data ?? [];
  }

  protected get conversationTags(): ConversationTag[] {
    return this.conversation().tags ?? [];
  }

  protected get availableTags(): Tag[] {
    const conversationTags = this.conversationTags;
    return this.tags.filter((tag) => !conversationTags.some((ct) => ct.id === String(tag.id)));
  }

  protected async addTag(tagId: number): Promise<void> {
    if (this.addingTag()) {
      return;
    }
    this.addingTag.set(true);
    try {
      await this.tagsStore.attachToConversation(this.conversation().id, tagId);
      this.change.emit();
    } catch {
      // React mutation-state parity: attach failures carry no inline error UI.
    } finally {
      this.addingTag.set(false);
    }
  }

  /** Conversation tag ids are strings; the wire detach route is numeric. */
  protected async removeTag(tagId: string): Promise<void> {
    if (this.removingTag()) {
      return;
    }
    this.removingTag.set(true);
    try {
      await this.tagsStore.removeFromConversation(this.conversation().id, Number(tagId));
      this.change.emit();
    } catch {
      // React mutation-state parity: detach failures carry no inline error UI.
    } finally {
      this.removingTag.set(false);
    }
  }

  protected async createTag(): Promise<void> {
    if (this.newTagName().trim().length === 0 || this.creatingTag()) {
      return;
    }
    this.creatingTag.set(true);
    try {
      const created = await this.tagsStore.createTag(this.newTagName(), this.selectedColor());
      this.newTagName.set('');
      this.showCreateForm.set(false);
      // Automatically add the new tag to the conversation (React parity).
      await this.addTag(created.id);
    } catch {
      // React parity: the create form stays open on failure (no error UI).
    } finally {
      this.creatingTag.set(false);
    }
  }

  protected openCreateForm(): void {
    this.showCreateForm.set(true);
  }

  protected cancelCreate(): void {
    this.showCreateForm.set(false);
  }

  protected onNameInput(event: Event): void {
    this.newTagName.set((event.target as HTMLInputElement).value);
  }
}
