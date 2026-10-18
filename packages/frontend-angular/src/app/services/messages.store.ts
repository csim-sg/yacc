import { Injectable, inject } from '@angular/core';

import { cacheKeys } from '../contracts/cache-keys';
import type { ListMessagesResponse, Message, SendMessageRequest } from '../contracts/http/messages.schema';
import { generateTempId } from '../lib/tempId';
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
 * Optimistic mechanism (U5): `sendPending`/`reconcile`/`fail`/`remove`/
 * `exists` port the React `useOptimisticMessage` semantics, but stay
 * TESTED-BUT-INACTIVE — the live send path is the server-confirmed append
 * (KISS default; activation is ANG-008's surfaced decision).
 */
@Injectable({ providedIn: 'root' })
export class MessagesStore {
  private readonly service = inject(MessagesService);
  private readonly conversations = inject(ConversationsStore);
  private readonly lists = new ResourceState<ListMessagesResponse>();

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
   * Send a message (server-confirmed append — the live React behavior):
   * on success the message is appended to the list cache and the
   * conversations family is invalidated. Rejects on failure — the
   * composer surfaces the typed error.
   */
  async send(conversationId: string, body: SendMessageRequest): Promise<Message> {
    const message = await this.service.send(conversationId, body);
    this.append(conversationId, message);
    this.conversations.invalidate();
    return message;
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
   * list (React `handleMessageReceived` parity): dedup by message id
   * (backlog replay re-delivers rows), append at the list tail — the
   * store's single ordering convention, matching the confirmed-send
   * append. No-op when the conversation's list is not loaded (parity:
   * React only patched an existing cache entry).
   */
  receiveInbound(message: Message): boolean {
    if (this.listSnapshot(message.conversationId)?.data === undefined) {
      return false; // List not loaded — no cache patch (parity).
    }
    if (this.exists(message.conversationId, message.id)) {
      return false; // Duplicate (e.g. backlog replay re-delivery).
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
   * (`message.sent` / `message.failed` handler parity). No-op when the
   * list is not loaded or the row is absent.
   */
  updateMessageStatus(
    conversationId: string,
    messageId: string,
    status: 'sent' | 'failed',
  ): void {
    this.lists.update(cacheKeys.conversations.messages(conversationId), (previous) => {
      if (!previous) {
        return undefined;
      }
      const messages = previous.messages.map((message) =>
        message.id === messageId ? { ...message, status } : message,
      );
      return { ...previous, messages };
    });
  }

  /** Invalidate every loaded conversation message list (the whole family). */
  invalidate(): void {
    this.lists.invalidate();
  }

  // ---------------------------------------------------------------------------
  // Optimistic mechanism (U5 — tested-but-inactive; activation is ANG-008)
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

  /** Reconcile a pending optimistic message with its server-confirmed row. */
  reconcile(conversationId: string, tempId: string, serverMessage: Message): void {
    this.lists.update(cacheKeys.conversations.messages(conversationId), (previous) => {
      if (!previous) {
        return previous;
      }
      // Dedup: never keep both the temp row and the confirmed row.
      const confirmed = previous.messages.some((message) => message.id === serverMessage.id);
      const messages = previous.messages
        .filter((message) => message.id !== tempId)
        .concat(confirmed ? [] : [serverMessage]);
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
