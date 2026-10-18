import { Injectable, inject } from '@angular/core';

import { cacheKeys } from '../contracts/cache-keys';
import type { ConversationDetail } from '../contracts/http/conversations.schema';
import type { ListConversationsParams, ListConversationsResponse } from '../contracts/http/conversations.schema';
import { ResourceState, type ResourceSnapshot } from './resource-state';
import { ConversationsService } from './conversations.service';

/**
 * Conversations resource store (T2 §3.1 — one resource store service per
 * backend resource family, built on `ResourceState<T>`).
 *
 * Query side: filtered/paginated lists + per-conversation details with
 * 30s freshness, stale-while-revalidate + keep-previous, per-key dedup.
 * Mutation side: status/priority/assignment changes invalidate the
 * conversation list + detail caches (B4 mapping: "invalidate conversation
 * + list"); errors rethrow — components surface them (no global error
 * boundary, parity).
 */
@Injectable({ providedIn: 'root' })
export class ConversationsStore {
  private readonly service = inject(ConversationsService);
  private readonly lists = new ResourceState<ListConversationsResponse>();
  private readonly details = new ResourceState<ConversationDetail>();

  /** Reactive snapshot of one filtered list entry, if loaded. */
  listSnapshot(params: ListConversationsParams): ResourceSnapshot<ListConversationsResponse> | undefined {
    return this.lists.snapshot(cacheKeys.conversations.list(params));
  }

  /** Reactive snapshot of one conversation detail, if loaded. */
  detailSnapshot(conversationId: string): ResourceSnapshot<ConversationDetail> | undefined {
    return this.details.snapshot(cacheKeys.conversations.detail(conversationId));
  }

  /**
   * Load (or refresh) a filtered list — errors land in the snapshot's
   * `error` field (TanStack `throwOnError: false` parity).
   */
  async loadList(params: ListConversationsParams = {}): Promise<void> {
    try {
      await this.lists.load(cacheKeys.conversations.list(params), () => this.service.list(params));
    } catch {
      // State carries the error; components render it.
    }
  }

  /** Load (or refresh) one conversation detail. */
  async loadDetail(conversationId: string): Promise<void> {
    try {
      await this.details.load(cacheKeys.conversations.detail(conversationId), async () => {
        const response = await this.service.getById(conversationId);
        return response.data;
      });
    } catch {
      // State carries the error.
    }
  }

  /** Invalidate the whole conversations family (list + details). */
  invalidate(): void {
    this.invalidateLists();
    this.details.invalidate();
  }

  /** Invalidate one conversation's detail cache. */
  invalidateDetail(conversationId: string): void {
    this.details.invalidate(cacheKeys.conversations.detail(conversationId));
  }

  /** PATCH /api/conversations/:id/status → invalidate detail + lists. */
  async updateStatus(
    conversationId: string,
    status: 'open' | 'pending' | 'resolved',
  ): Promise<void> {
    await this.service.updateStatus(conversationId, { status });
    this.invalidateDetail(conversationId);
    this.invalidateLists();
  }

  /** PATCH /api/conversations/:id/priority → invalidate detail + lists. */
  async updatePriority(
    conversationId: string,
    priority: 'low' | 'normal' | 'high' | 'urgent',
  ): Promise<void> {
    await this.service.updatePriority(conversationId, { priority });
    this.invalidateDetail(conversationId);
    this.invalidateLists();
  }

  /** PATCH /api/conversations/:id/assign (admin+) → invalidate detail + lists. */
  async assignById(conversationId: string, assignedUserId: string): Promise<void> {
    await this.service.assignById(conversationId, { assignedUserId });
    this.invalidateDetail(conversationId);
    this.invalidateLists();
  }

  /** POST /api/conversations/:id/assign (manager+) → invalidate detail + lists. */
  async assign(conversationId: string, assignedUserId: string): Promise<void> {
    await this.service.assign(conversationId, { assignedUserId });
    this.invalidateDetail(conversationId);
    this.invalidateLists();
  }

  private invalidateLists(): void {
    this.lists.invalidate(cacheKeys.conversations.all());
  }
}
