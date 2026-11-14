import { Injectable, inject } from '@angular/core';

import { cacheKeys } from '../contracts/cache-keys';
import type { ListMessagesResponse, Message, SendMessageRequest } from '../contracts/http/messages.schema';
import { generateTempId } from '../lib/tempId';
import { AuthService } from './auth.service';
import { ConversationsStore } from './conversations.store';
import { MessagesService } from './messages.service';
import { ResourceState } from './resource-state';

/**
 * Messages resource store (T2 §3.1; the `conversationMessages` family).
 *
 * Query side: per-conversation message lists on `ResourceState<T>`.
 * Mutation side (B4 mapping): a confirmed send appends to the list cache
 * and invalidates the conversations family; `retryMessage` patches the
 * message in place and invalidates the same way.
 *
 * Optimistic mechanism (U5 — ACTIVATED by founder-authorized #499,
 * 2026-11-13; supersedes the "tested-but-inactive" disposition): the
 * live send path appends a pending row (`{id: tempId, status: 'pending'}`)
 * BEFORE the POST, reconciles the tempId to the 201's returned server
 * row (exactly one row; `tempId` stays reachable as a secondary key
 * through the alias map), and rolls the row to `failed` on
 * HTTP/transport failure. `updateMessageStatus` matches
 * `id === messageId || tempId === messageId` and is idempotent —
 * duplicate frames patch the same row once, never duplicating rows.
 *
 * Send split (#507): the send is two store operations — `beginSend`
 * (create the pending row, return its tempId) and `dispatchSend`
 * (POST → reconcile / fail). The conversation page awaits exactly ONE
 * Angular render boundary between them (`afterNextRender`, #507), so
 * the pending state is rendered — observable — before the request is
 * issued. The request payload, reconcile, failure rollback, alias map,
 * idempotent status patches and the server-id-only retry guard are
 * unchanged; only the dispatch TIMING relative to the first render of
 * the pending row differs.
 */
@Injectable({ providedIn: 'root' })
export class MessagesStore {
  private readonly service = inject(MessagesService);
  private readonly conversations = inject(ConversationsStore);
  private readonly auth = inject(AuthService);
  private readonly lists = new ResourceState<ListMessagesResponse>();

  /**
   * Bounded re-delivery window for the message-id dedup (AC-5, #499):
   * the most recent inbound message ids, so a re-delivered
   * `message.received` frame cannot double-count unread/preview patches
   * even when the conversation's detail list is not loaded.
   */
  private static readonly RECENT_INBOUND_LIMIT = 256;
  private readonly recentInboundIds = new Set<string>();

  /**
   * Optimistic secondary key (AC-4, #499): tempId → server message id,
   * recorded at reconcile so a status frame that still references the
   * tempId patches the reconciled server row (`id === messageId ||
   * tempId === messageId`). Bounded by sends per session; each tempId is
   * recorded exactly once (duplicate frames keep the first mapping).
   */
  private readonly tempIdAliases = new Map<string, string>();

  /** Reactive snapshot of one conversation's message list, if loaded. */
  listSnapshot(conversationId: string) {
    return this.lists.snapshot(cacheKeys.conversations.messages(conversationId));
  }

  /** Load (or refresh) a conversation's messages (error lands in state). */
  async loadMessages(
    conversationId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<void> {
    try {
      // The live path loads the canonical (first-page) key; params ride
      // the request, not the cache spelling (single canonical registry).
      void params;
      await this.lists.load(
        cacheKeys.conversations.messages(conversationId),
        () => this.service.list(conversationId, params),
      );
    } catch {
      // State carries the error.
    }
  }

  /**
   * First half of the split send (U5, #499; the #507 render-ordering
   * contract): create the optimistic pending row NOW and return its
   * tempId, so the caller can render it before issuing the POST.
   *
   * Returns `null` when the conversation's list is not loaded — there is
   * no loaded snapshot to append the row to (the append would no-op), so
   * there is no row to render and no boundary to wait for; the caller
   * dispatches directly (the pre-#499 behavior: POST without an
   * optimistic row). On a loaded list the returned tempId is already in
   * the list snapshot when this call returns — the caller must await one
   * render boundary before `dispatchSend`.
   */
  beginSend(conversationId: string, body: SendMessageRequest): string | null {
    if (this.listSnapshot(conversationId)?.data === undefined) {
      return null;
    }
    return this.sendPending(conversationId, {
      body: body.body,
      senderName: this.auth.user()?.name ?? 'Agent',
    });
  }

  /**
   * Second half of the split send (U5, #499/#507): POST the message and
   * settle the optimistic row — `reconcile` with the 201's returned
   * server row (the frozen send operation answers a PENDING server
   * message) on success, `fail` on HTTP/transport failure. The
   * conversations family is invalidated on success (B4 mapping).
   * Rejects on failure — the composer surfaces the typed error and the
   * failed temp row keeps the retry affordance (server-id rows only;
   * the click guard is the conversation page's).
   *
   * Callers MUST have rendered the pending row first (one render
   * boundary between `beginSend` and this call — #507). A `null` tempId
   * (unloaded list, see `beginSend`) dispatches without reconciliation:
   * the row-less path matches the pre-#499 behavior where both
   * `reconcile` and `fail` would no-op on a missing snapshot.
   */
  async dispatchSend(
    conversationId: string,
    tempId: string | null,
    body: SendMessageRequest,
  ): Promise<Message> {
    try {
      const message = await this.service.send(conversationId, body);
      if (tempId !== null) {
        this.reconcile(conversationId, tempId, message);
      }
      this.conversations.invalidate();
      return message;
    } catch (err: unknown) {
      if (tempId !== null) {
        this.fail(conversationId, tempId);
      }
      throw err;
    }
  }

  /**
   * Retry a failed message (`POST .../messages/:messageId/retry`) —
   * patches the message in place and invalidates the conversations
   * family. Exactly-once click tracking is the caller's affordance.
   */
  async retryMessage(conversationId: string, messageId: string): Promise<void> {
    const response = await this.service.retry(conversationId, messageId);
    this.lists.update(cacheKeys.conversations.messages(conversationId), (previous) => {
      if (!previous) {
        return previous;
      }
      const messages = previous.messages.map((message) =>
        message.id === messageId ? response.data : message,
      );
      return { ...previous, messages };
    });
    this.conversations.invalidate();
  }

  // ---------------------------------------------------------------------------
  // Real-time write surface (ANG-006 handlers; React event-handler parity)
  // ---------------------------------------------------------------------------

  /**
   * Append an inbound `message.received` row to a loaded conversation's
   * list (React `handleMessageReceived` parity): append at the list tail
   * — the store's single ordering convention, matching the
   * confirmed-send append. No-op when the conversation's list is not
   * loaded (parity: React only patched an existing cache entry).
   *
   * Returns whether this frame is the FIRST delivery of the message id —
   * the ONE re-delivery filter (backlog replay + room fan-out
   * re-delivery). The bounded recent-id window (AC-5, #499) answers the
   * dedup even when the detail list is not loaded, so inbox
   * preview/unread patching cannot double-count; the loaded-list
   * existence check stays as the second gate.
   */
  receiveInbound(message: Message): boolean {
    if (this.recentInboundIds.has(message.id)) {
      return false; // Re-delivery (backlog replay / duplicate frame).
    }
    this.rememberInboundId(message.id);
    if (this.listSnapshot(message.conversationId)?.data === undefined) {
      return true; // New frame — no cache patch (list not loaded, parity).
    }
    if (this.exists(message.conversationId, message.id)) {
      return false; // Duplicate already in the loaded list.
    }
    this.lists.update(cacheKeys.conversations.messages(message.conversationId), (previous) => {
      if (!previous) {
        return undefined;
      }
      return {
        ...previous,
        messages: [...previous.messages, message],
        total: previous.total + 1,
      };
    });
    return true;
  }

  /**
   * Patch one message's delivery `status` in a loaded list
   * (`message.sent` / `message.failed` handler parity). The match is
   * id-agnostic (AC-4/AC-6, #499): the frame's message id may be the
   * server id or the optimistic tempId — `id === messageId ||
   * tempId === messageId` via the reconcile alias map. Idempotent: a
   * duplicate frame patches the same row to the same status, never
   * duplicating rows. No-op when the list is not loaded or the row is
   * absent.
   */
  updateMessageStatus(
    conversationId: string,
    messageId: string,
    status: 'sent' | 'failed',
  ): void {
    const alias = this.tempIdAliases.get(messageId);
    this.lists.update(cacheKeys.conversations.messages(conversationId), (previous) => {
      if (!previous) {
        return undefined;
      }
      const messages = previous.messages.map((message) =>
        message.id === messageId || (alias !== undefined && message.id === alias)
          ? { ...message, status }
          : message,
      );
      return { ...previous, messages };
    });
  }

  /** Invalidate every loaded conversation message list (the whole family). */
  invalidate(): void {
    this.lists.invalidate();
  }

  // ---------------------------------------------------------------------------
  // Optimistic mechanism (U5 — ACTIVATED by founder-authorized #499)
  // ---------------------------------------------------------------------------

  /** Append a pending optimistic message keyed by `tempId`. */
  sendPending(
    conversationId: string,
    draft: { body: string; senderName: string },
  ): string {
    const tempId = generateTempId();
    const now = new Date().toISOString();
    const pending: Message = {
      id: tempId,
      conversationId,
      senderName: draft.senderName,
      body: draft.body,
      status: 'pending',
      direction: 'outbound',
      createdAt: now,
      updatedAt: now,
    };
    this.append(conversationId, pending);
    return tempId;
  }

  /**
   * Reconcile a pending optimistic message with its server-confirmed row
   * (U5, #499): the temp row is replaced exactly once — the server row
   * becomes the single row for that body, and `tempId` stays reachable
   * as a secondary key through the alias map (status frames may still
   * reference it). Race-safe: a delivery status a status frame already
   * applied (by server id or tempId) before the 201 resolved is never
   * regressed by the returned pending row, and re-reconciliation is a
   * no-op on the row set (one alias per tempId).
   */
  reconcile(conversationId: string, tempId: string, serverMessage: Message): void {
    if (!this.tempIdAliases.has(tempId)) {
      this.tempIdAliases.set(tempId, serverMessage.id);
    }
    this.lists.update(cacheKeys.conversations.messages(conversationId), (previous) => {
      if (!previous) {
        return previous;
      }
      // Never keep both the temp row and the confirmed row; preserve a
      // status a racing frame already applied (sent/failed beats the
      // server row's pending default).
      const confirmedRow = previous.messages.find((message) => message.id === serverMessage.id);
      const tempRow = previous.messages.find((message) => message.id === tempId);
      const racedStatus =
        confirmedRow?.status ?? (tempRow && tempRow.status !== 'pending' ? tempRow.status : null);
      const reconciled: Message = racedStatus
        ? { ...serverMessage, status: racedStatus }
        : serverMessage;
      const messages = previous.messages
        .filter((message) => message.id !== tempId && message.id !== serverMessage.id)
        .concat([reconciled]);
      return { ...previous, messages };
    });
  }

  /** Roll a pending optimistic message to `failed` (retry affordance). */
  fail(conversationId: string, tempId: string): void {
    this.lists.update(cacheKeys.conversations.messages(conversationId), (previous) => {
      if (!previous) {
        return previous;
      }
      const messages = previous.messages.map((message) =>
        message.id === tempId ? { ...message, status: 'failed' as const } : message,
      );
      return { ...previous, messages };
    });
  }

  /** Drop an optimistic message (e.g. user discarded the failed row). */
  remove(conversationId: string, tempId: string): void {
    this.lists.update(cacheKeys.conversations.messages(conversationId), (previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        messages: previous.messages.filter((message) => message.id !== tempId),
      };
    });
  }

  /** Whether a message id (server or temp) exists in the loaded list. */
  exists(conversationId: string, messageId: string): boolean {
    const data = this.listSnapshot(conversationId)?.data;
    return data?.messages.some((message) => message.id === messageId) ?? false;
  }

  /** Record one inbound id in the bounded re-delivery window (oldest evicted). */
  private rememberInboundId(id: string): void {
    this.recentInboundIds.add(id);
    if (this.recentInboundIds.size > MessagesStore.RECENT_INBOUND_LIMIT) {
      const oldest = this.recentInboundIds.values().next().value;
      if (oldest !== undefined) {
        this.recentInboundIds.delete(oldest);
      }
    }
  }

  private append(conversationId: string, message: Message): void {
    this.lists.update(cacheKeys.conversations.messages(conversationId), (previous) => {
      if (!previous) {
        return previous;
      }
      return {
        ...previous,
        messages: [...previous.messages, message],
        total: previous.total + 1,
      };
    });
  }
}
