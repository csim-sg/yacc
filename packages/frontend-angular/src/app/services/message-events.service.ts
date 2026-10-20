import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { WebSocketClientService } from './websocket-client.service';
import { ConversationsStore } from './conversations.store';
import { MessagesStore } from './messages.store';
import type { Message } from '../contracts/http/messages.schema';

/**
 * Message-domain real-time handler (the React
 * `event-handlers/message.handler` port on the frozen raw-WS channels):
 *
 * - `message.received` → append the inbound row to the loaded list cache
 *   with id dedup (backlog replay re-delivers rows), then invalidate the
 *   conversations list ("last message" parity).
 * - `message.sent` → patch the row's status to `sent` in the loaded
 *   list, then invalidate the conversations list.
 * - `message.failed` → patch the row's status to `failed`, then
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
    this.messages.receiveInbound(message);
    this.conversations.invalidateLists();
  }

  private handleStatus(conversationId: string, messageId: string, status: 'sent' | 'failed'): void {
    this.messages.updateMessageStatus(conversationId, messageId, status);
    this.conversations.invalidateLists();
  }
}
