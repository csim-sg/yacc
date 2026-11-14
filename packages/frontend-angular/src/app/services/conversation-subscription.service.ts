import { Injectable, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { WebSocketClientService } from './websocket-client.service';

/**
 * Bounded inbox interest (AC-2, #499): the inbox subscription set is
 * capped at the list page size — the ids CURRENTLY RENDERED in the
 * loaded page, never "all conversations", never an unbounded scan.
 * The inbox page renders at most one page, so this bound is also the
 * hard ceiling enforced by `setInboxPage` (asserted in the specs).
 */
export const INBOX_INTEREST_LIMIT = 20;

/**
 * The ONE subscription-state owner (AC-1..AC-3, #499 — founder-authorized
 * B14 narrowing): conversation-scoped room interest over the frozen
 * `subscribe.conversation` / `unsubscribe.conversation` control channels.
 *
 * - Interest = the active detail conversation (route `/conversations/:id`)
 *   ∪ the rendered inbox page ids (bounded by `INBOX_INTEREST_LIMIT`).
 *   Both sources report through `setActive` / `setInboxPage`; no
 *   per-component ad-hoc subscribes exist.
 * - Every interest change is applied as a diff against the server-known
 *   membership: departing rooms are unsubscribed BEFORE arriving rooms
 *   are subscribed (AC-1 switch semantics), and a room already joined or
 *   pending is never subscribed twice (AC-1 duplicate suppression).
 * - Ack handling: `conversation.subscribed {conversationId}` promotes the
 *   pending request to joined; a `system.error` frame (e.g. `bad_frame`)
 *   fails the in-flight subscribes and a MISMATCHED ack (no request in
 *   flight) is ignored — neither loops; the room is re-attempted at most
 *   once per later (re)open.
 * - Reconnect (AC-3): on the `connect$` seam ONLY — after every
 *   successful (re)open the whole interest set is re-subscribed once
 *   (the fresh transport session carries no server-side memberships).
 *   This is additive: the R1 reconnect ladder, the 60s heartbeat
 *   handling and backlog replay are not touched (no new timers, no
 *   status changes, no cache invalidation here).
 * - The transport client stays dumb: it owns the two frozen control
 *   sends + ack routing only; this service owns all state. Logout
 *   resets everything (the binding calls `reset()` on the auth-false
 *   transition) so a later session never inherits interest rows.
 */
@Injectable({ providedIn: 'root' })
export class ConversationSubscriptionService {
  private readonly client = inject(WebSocketClientService);

  /** Detail-open conversation id (single active detail) or null. */
  private activeDetail: string | null = null;
  /** Conversation ids of the currently rendered inbox page. */
  private readonly inbox = new Set<string>();
  /** Rooms the server acked as joined for the CURRENT transport session. */
  private readonly joined = new Set<string>();
  /** Subscribe frames sent whose ack has not arrived yet. */
  private readonly pending = new Set<string>();

  private readonly subscription = new Subscription();

  constructor() {
    // AC-3: re-subscription rides the `connect$` seam only — once per
    // successful (re)open, idempotent. The ladder/heartbeat/backlog
    // paths are not consulted from here.
    this.subscription.add(this.client.connect$.subscribe(() => this.onConnect()));
    this.subscription.add(
      this.client
        .on$('conversation.subscribed')
        .subscribe((ack) => this.onSubscribed(ack.conversationId)),
    );
    this.subscription.add(
      this.client
        .on$('conversation.unsubscribed')
        .subscribe((ack) => this.onUnsubscribed(ack.conversationId)),
    );
    this.subscription.add(this.client.on$('system.error').subscribe(() => this.onSystemError()));
  }

  /**
   * Set the active detail conversation (route `/conversations/:id`):
   * subscribe it — unsubscribing the PREVIOUS active first (AC-1 order)
   * — and release the rendered inbox ids except this one (AC-2
   * inbox → detail navigation). `null` on leave.
   */
  setActive(conversationId: string | null): void {
    if (this.activeDetail === conversationId) {
      return; // Already the active interest — never a duplicate subscribe.
    }
    this.activeDetail = conversationId;
    if (conversationId !== null) {
      this.inbox.clear(); // Release inbox ids except the one staying open.
    }
    this.apply();
  }

  /**
   * Replace the rendered inbox page ids (AC-2): subscribe newly visible
   * ids, unsubscribe departed ones (diff — no subscribe for unrendered
   * ids), hard-capped at `INBOX_INTEREST_LIMIT` (the list page size).
   */
  setInboxPage(conversationIds: string[]): void {
    const bounded = conversationIds.slice(0, INBOX_INTEREST_LIMIT);
    if (this.sameIds(bounded)) {
      return; // Same rendered page — no churn.
    }
    this.inbox.clear();
    for (const id of bounded) {
      this.inbox.add(id);
    }
    this.apply();
  }

  /**
   * Leaving the inbox (route destroy): release the whole rendered-page
   * interest. The active detail conversation — when the navigation is
   * inbox → detail — is retained (it left the inbox set in `setActive`).
   */
  releaseInbox(): void {
    if (this.inbox.size === 0) {
      return;
    }
    this.inbox.clear();
    this.apply();
  }

  /** Whether `conversationId` is the active detail conversation. */
  isActive(conversationId: string): boolean {
    return this.activeDetail === conversationId;
  }

  /**
   * Drop every interest/membership row (logout / session end — the
   * binding's auth-false transition). No unsubscribe frames: the
   * transport session is going away with the identity.
   */
  reset(): void {
    this.activeDetail = null;
    this.inbox.clear();
    this.joined.clear();
    this.pending.clear();
  }

  /** Teardown for specs (prod keeps the app-lifetime singleton bound). */
  stop(): void {
    this.subscription.unsubscribe();
  }

  // -------------------------------------------------------------------------
  // Interest application (the ONE diff point) + ack/error reducers
  // -------------------------------------------------------------------------

  /** The desired membership: rendered inbox ids ∪ the active detail. */
  private interest(): Set<string> {
    const desired = new Set(this.inbox);
    if (this.activeDetail !== null) {
      desired.add(this.activeDetail);
    }
    return desired;
  }

  /**
   * Diff the desired interest against server-known membership and send
   * only the deltas. Contract order (AC-1): every unsubscribe is sent
   * BEFORE any subscribe — a switch unsubscribes the previous room
   * first. A room already joined or pending is never subscribed twice
   * (AC-1 duplicate suppression). Frames ride an OPEN socket only; when
   * the transport is down nothing is sent and the next `connect$` pass
   * re-sends the whole interest set.
   */
  private apply(): void {
    const desired = this.interest();
    const connected = this.client.isConnected();

    const releases: string[] = [];
    for (const id of this.joined) {
      if (!desired.has(id)) {
        releases.push(id);
      }
    }
    for (const id of this.pending) {
      if (!desired.has(id)) {
        releases.push(id);
      }
    }
    for (const id of releases) {
      this.joined.delete(id);
      this.pending.delete(id);
      if (connected) {
        this.client.unsubscribeConversation(id);
      }
    }

    if (!connected) {
      return;
    }
    for (const id of desired) {
      if (this.joined.has(id) || this.pending.has(id)) {
        continue;
      }
      this.pending.add(id);
      this.client.subscribeConversation(id);
    }
  }

  /** A fresh transport session: no server-side memberships survive. */
  private onConnect(): void {
    this.joined.clear();
    this.pending.clear();
    this.apply();
  }

  /** Ack reducer: pending → joined (AC-1). */
  private onSubscribed(conversationId: string): void {
    if (!this.pending.delete(conversationId)) {
      // Mismatched ack — no request in flight. No loop, no state row:
      // the room is re-attempted at most once per later (re)open.
      return;
    }
    this.joined.add(conversationId);
  }

  /** Unsubscribed ack: the room is no longer joined (AC-1 leave). */
  private onUnsubscribed(conversationId: string): void {
    this.joined.delete(conversationId);
  }

  /**
   * Any `system.error` while subscribes are in flight fails those
   * attempts (e.g. `bad_frame`): the frames are surfaced through the
   * existing error channel (SystemEventsService → state row) and there
   * is NO immediate retry (AC-1 no-retry-storm) — the interest set is
   * re-sent once on the next (re)open via `onConnect`.
   */
  private onSystemError(): void {
    this.pending.clear();
  }

  /** Order-sensitive equality for the rendered-page diff guard. */
  private sameIds(ids: string[]): boolean {
    if (ids.length !== this.inbox.size) {
      return false;
    }
    return ids.every((id) => this.inbox.has(id));
  }
}
