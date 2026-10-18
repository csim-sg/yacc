import { Injectable, inject } from '@angular/core';

import { cacheKeys } from '../contracts/cache-keys';
import type { Tag } from '../contracts/http/tags.schema';
import type { ListTagsResponse } from '../contracts/http/tags.schema';
import { ConversationsStore } from './conversations.store';
import { ResourceState, type ResourceSnapshot } from './resource-state';
import { TagsService } from './tags.service';

/**
 * Tags resource store (T2 §3.2 `tags.store` row): the store IS the
 * resource store — one state location for the tag list and its CRUD, on
 * `ResourceState<T>`. Mutations mirror the React invalidation mapping:
 * attach/detach invalidate the conversation + list caches (B4).
 */
@Injectable({ providedIn: 'root' })
export class TagsStore {
  private readonly service = inject(TagsService);
  private readonly conversations = inject(ConversationsStore);
  private readonly state = new ResourceState<ListTagsResponse>();

  /** Reactive snapshot of the tag list, if loaded. */
  snapshot(): ResourceSnapshot<ListTagsResponse> | undefined {
    return this.state.snapshot(cacheKeys.tags.all());
  }

  /** Load (or refresh) the tag list (error lands in state). */
  async fetchTags(): Promise<void> {
    try {
      await this.state.load(cacheKeys.tags.all(), () => this.service.list());
    } catch {
      // State carries the error.
    }
  }

  /** POST /api/tags — appends the created tag to the cached list. */
  async createTag(name: string, color: string): Promise<Tag> {
    const response = await this.service.create({ name, color });
    const created = response.data;
    this.state.update(cacheKeys.tags.all(), (previous) =>
      previous ? { ...previous, data: [...previous.data, created] } : previous,
    );
    return created;
  }

  /** POST /api/conversations/:id/tags → invalidate conversation + list. */
  async attachToConversation(conversationId: string, tagId: number): Promise<void> {
    await this.service.attach(conversationId, { tagId });
    this.conversations.invalidate();
  }

  /** DELETE /api/conversations/:id/tags/:tagId → invalidate conversation + list. */
  async removeFromConversation(conversationId: string, tagId: number): Promise<void> {
    await this.service.detach(conversationId, tagId);
    this.conversations.invalidate();
  }
}
