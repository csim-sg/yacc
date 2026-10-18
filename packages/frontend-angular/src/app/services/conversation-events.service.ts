import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { WebSocketClientService } from './websocket-client.service';
import { ConversationsStore } from './conversations.store';

/**
 * Conversation-domain real-time handler (the React
 * `event-handlers/conversation.handler` port on the frozen raw-WS
 * channels):
 *
 * - `conversation.updated` → invalidate the conversation's detail cache
 *   + every conversations list (B4 mapping — updates are idempotent
 *   refetches; the backend sends no `eventId`, none is depended on).
 * - `conversation.reopened` → the same invalidations. U2 DISPOSITION:
 *   the frozen channel is declared with no pinned payload shape and the
 *   backend emitter decision is an OPEN founder product decision — this
 *   listener encodes the frozen wire truth and claims NO live coverage
 *   (parity-of-absence until backend evidence; never asserted as
 *   covered behavior).
 */
@Injectable({ providedIn: 'root' })
export class ConversationEventsService {
  private readonly client = inject(WebSocketClientService);
  private readonly conversations = inject(ConversationsStore);

  /** Subscribe the handler set; returns the teardown subscription. */
  bind(): Subscription {
    const updated = this.client
      .on$('conversation.updated')
      .subscribe((payload) => this.handleUpdated(payload.conversationId));

    const reopened = this.client
      .on$('conversation.reopened')
      .subscribe((payload) => this.handleReopened(payload.conversationId));

    return new Subscription(() => {
      updated.unsubscribe();
      reopened.unsubscribe();
    });
  }

  private handleUpdated(conversationId: string): void {
    this.conversations.invalidateDetail(conversationId);
    this.conversations.invalidateLists();
  }

  private handleReopened(conversationId: string | undefined): void {
    // The frozen payload pins no required members — the detail cache is
    // only invalidated when the row identifies the conversation.
    if (conversationId !== undefined) {
      this.conversations.invalidateDetail(conversationId);
    }
    this.conversations.invalidateLists();
  }
}
