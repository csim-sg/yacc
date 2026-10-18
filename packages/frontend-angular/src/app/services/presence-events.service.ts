import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { WS_TYPING_CLEAR_MS } from '../contracts/ws/connection';
import { WebSocketClientService } from './websocket-client.service';
import { WebSocketStateService } from './websocket-state.service';

/**
 * Presence + typing real-time handler (the React
 * `event-handlers/presence.handler` + `typing.handler` port on the
 * frozen raw-WS channels):
 *
 * - `presence.updated` → the MIG-003 canonical payload
 *   `{userId, status: online|offline, lastSeen}` writes the
 *   `WebSocketStateService` presence row (the retired `{userId,
 *   isOnline, timestamp}` variant and the richer React listener type are
 *   NOT ported — T3-G4 parity is the canonical shape).
 * - `typing.started` → typing row + a 5s auto-clear timer (every timer
 *   either fires and self-removes or is cleared by
 *   `typing.stopped`/restart — no leaked timers).
 * - `typing.stopped` → typing row removed + its pending timer cleared.
 *
 * W20/W21 state halves only — the indicator UI itself is ANG-007/008
 * feature surface. No `eventId` dedup (the field is never sent,
 * T3-G10).
 */
@Injectable({ providedIn: 'root' })
export class PresenceEventsService {
  private readonly client = inject(WebSocketClientService);
  private readonly websocketState = inject(WebSocketStateService);

  /** Pending auto-clear timers, keyed conversation → user (React parity). */
  private readonly typingTimers = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

  /** Subscribe the handler set; returns the teardown subscription. */
  bind(): Subscription {
    const presence = this.client.on$('presence.updated').subscribe((payload) => {
      this.websocketState.setUserPresence(payload.userId, payload.status, payload.lastSeen);
    });

    const typingStarted = this.client.on$('typing.started').subscribe((payload) => {
      this.handleTypingStarted(payload.conversationId, payload.userId, payload.name);
    });

    const typingStopped = this.client.on$('typing.stopped').subscribe((payload) => {
      this.handleTypingStopped(payload.conversationId, payload.userId);
    });

    return new Subscription(() => {
      presence.unsubscribe();
      typingStarted.unsubscribe();
      typingStopped.unsubscribe();
      this.clearAllTypingTimers();
    });
  }

  private handleTypingStarted(conversationId: string, userId: string, userName: string): void {
    this.websocketState.addTypingUser(conversationId, userId, userName);

    // Restart the auto-clear window for repeat `typing.started` rows.
    this.clearTypingTimer(conversationId, userId);
    const timer = setTimeout(() => {
      this.clearTypingTimer(conversationId, userId);
      this.websocketState.removeTypingUser(conversationId, userId);
    }, WS_TYPING_CLEAR_MS);
    this.typingTimersFor(conversationId).set(userId, timer);
  }

  private handleTypingStopped(conversationId: string, userId: string): void {
    this.clearTypingTimer(conversationId, userId);
    this.websocketState.removeTypingUser(conversationId, userId);
  }

  private typingTimersFor(conversationId: string): Map<string, ReturnType<typeof setTimeout>> {
    let conversation = this.typingTimers.get(conversationId);
    if (!conversation) {
      conversation = new Map();
      this.typingTimers.set(conversationId, conversation);
    }
    return conversation;
  }

  private clearTypingTimer(conversationId: string, userId: string): void {
    const conversation = this.typingTimers.get(conversationId);
    const timer = conversation?.get(userId);
    if (conversation && timer !== undefined) {
      clearTimeout(timer);
      conversation.delete(userId);
      if (conversation.size === 0) {
        this.typingTimers.delete(conversationId);
      }
    }
  }

  private clearAllTypingTimers(): void {
    for (const conversation of this.typingTimers.values()) {
      for (const timer of conversation.values()) {
        clearTimeout(timer);
      }
    }
    this.typingTimers.clear();
  }
}
