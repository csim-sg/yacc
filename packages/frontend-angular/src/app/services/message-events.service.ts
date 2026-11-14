import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { WebSocketClientService } from './websocket-client.service';
import { ConversationSubscriptionService } from './conversation-subscription.service';
import { ConversationsStore } from './conversations.store';
import { MessagesStore } from './messages.store';
import type { Message } from '../contracts/http/messages.schema';

/**
 * Message-domain real-time handler (the React
 * `event-handlers/message.handler` port on the frozen raw-WS channels):
 *
 * - `message.received` → append the inbound row to the loaded list cache
 *   behind the message-id re-delivery dedup, then patch the loaded
 *   conversations-list rows locally (`latestMessagePreview` = body;
 *   `unreadCount` +1 only for a NON-active conversation — #499 AC-5).
 *   The blanket `invalidateLists()` deliberately does NOT run on this
 *   path: the connector relay is publish-only (it never persists), so a
 *   refetch returns pre-persist data and would clobber the local patch
 *   with stale rows. The invalidate stays only where it is still
 *   correct — the status handlers below (persisted delivery
 *   transitions) and the `connect$` re-open invalidation; list truth
 *   converges through those persisted-change paths.
 * - `message.sent` → patch the row's status to `sent` in the loaded
 *   list (id-agnostic: server id or optimistic tempId), then invalidate
 *   the conversations list.
 * - `message.failed` → same id-agnostic path to `failed`, then
 *   invalidate the conversations list.
 *
 * The wire payloads are the FROZEN shapes (`message-sent`/
 * `message-failed.schema.json`: `sentAt`/`retryAt` — not the Node-era
 * declared fields, which R1 supersedes). No `eventId` dedup: the field
 * does not exist on the wire (T3-G10); message-id uniqueness is the
 * dedup mechanism, exactly as recorded in the React handler.
 */
@Injectable({ providedIn: 'root' })
export class MessageEventsService {
  private readonly client = inject(WebSocketClientService);
  private readonly messages = inject(MessagesStore);
  private readonly conversations = inject(ConversationsStore);
  private readonly subscriptions = inject(ConversationSubscriptionService);

  /** Subscribe the handler set; returns the teardown subscription. */
  bind(): Subscription {
    const received = this.client
      .on$('message.received')
      .subscribe((payload) => this.handleReceived(payload));

    const sent = this.client
      .on$('message.sent')
      .subscribe((payload) => this.handleStatus(payload.conversationId, payload.messageId, 'sent'));

    const failed = this.client
      .on$('message.failed')
      .subscribe((payload) =>
        this.handleStatus(payload.conversationId, payload.messageId, 'failed'),
      );

    return new Subscription(() => {
      received.unsubscribe();
      sent.unsubscribe();
      failed.unsubscribe();
    });
  }

  /** Map the frozen wire payload onto the store's `Message` row shape. */
  private handleReceived(payload: {
    messageId: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    body: string;
    timestamp: string;
  }): void {
    // Inbound platform messages are already delivered — `sent` (parity).
    const message: Message = {
      id: payload.messageId,
      conversationId: payload.conversationId,
      senderId: payload.senderId,
      senderName: payload.senderName,
      body: payload.body,
      status: 'sent',
      direction: 'inbound',
      createdAt: payload.timestamp,
      updatedAt: payload.timestamp,
    };
    // Re-delivery dedup (message id): a duplicate frame is a no-op —
    // never a second timeline row, never a second unread increment.
    if (!this.messages.receiveInbound(message)) {
      return;
    }
    this.conversations.patchReceived(payload.conversationId, payload.body, {
      incrementUnread: !this.subscriptions.isActive(payload.conversationId),
    });
  }

  private handleStatus(conversationId: string, messageId: string, status: 'sent' | 'failed'): void {
    this.messages.updateMessageStatus(conversationId, messageId, status);
    this.conversations.invalidateLists();
  }
}
