import { Component, DestroyRef, EnvironmentInjector, InjectionToken, NgZone, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { RightPanel } from '../../components/right-panel/right-panel';
import { ReplyComposer } from '../../components/reply-composer/reply-composer';
import type {
  ChannelType,
  ConversationDetail,
  ConversationPriority,
  ConversationStatus,
} from '../../contracts/http/conversations.schema';
import type { Message } from '../../contracts/http/messages.schema';
import type { ResourceSnapshot } from '../../services/resource-state';
import { apiErrorMessage } from '../../lib/api-error-message';
import { isTempId } from '../../lib/tempId';
import { AuthService } from '../../services/auth.service';
import { ConversationSubscriptionService } from '../../services/conversation-subscription.service';
import { ConversationsStore } from '../../services/conversations.store';
import { MessagesStore } from '../../services/messages.store';

/** Channel display labels (React `CHANNEL_LABELS` parity). */
const CHANNEL_LABELS: Record<ChannelType, string> = {
  telegram: 'Telegram',
  irc: 'IRC',
  email: 'Email',
  slack: 'Slack',
  whatsapp: 'WhatsApp',
  wechat: 'WeChat',
  meta: 'Meta',
  x: 'X (Twitter)',
};

/** Priority → daisyUI badge class (React `PRIORITY_BADGE` parity). */
const PRIORITY_BADGE: Record<ConversationPriority, string> = {
  low: 'badge-ghost',
  normal: 'badge-info',
  high: 'badge-warning',
  urgent: 'badge-error',
};

/** Status → daisyUI badge class (React `STATUS_BADGE` parity). */
const STATUS_BADGE: Record<ConversationStatus, string> = {
  open: 'badge-success',
  pending: 'badge-warning',
  resolved: 'badge-neutral',
};

/**
 * One Angular render boundary (#507): the send handler awaits this
 * between `beginSend` (optimistic pending row) and `dispatchSend`
 * (POST), so the pending state is rendered — observable — before the
 * request is issued. The production implementation registers a one-shot
 * `afterNextRender` callback (rAF-aligned scheduling; never a fixed
 * timeout, no polling, no retry tuning) on the root `EnvironmentInjector`
 * and resolves inside the Angular zone so the dispatch continuation
 * stays zone-affine (after-render hooks run outside it). Injectable so
 * the unit invariant test can drive a controlled boundary.
 */
export const RENDER_BOUNDARY = new InjectionToken<() => Promise<void>>(
  'Conversation send render boundary (#507)',
  {
    providedIn: 'root',
    factory: (): (() => Promise<void>) => {
      const injector = inject(EnvironmentInjector);
      const zone = inject(NgZone);
      return () =>
        new Promise<void>((resolve) => {
          afterNextRender(() => zone.run(() => resolve()), { injector });
        });
    },
  },
);

/**
 * Conversation Detail Page (React `pages/ConversationPage.tsx` port —
 * W7; the parity crux).
 *
 * Timeline + reply composer + exactly-once retry against the canonical
 * stores: the detail rides `ConversationsStore.loadDetail`, the messages
 * list rides `MessagesStore.loadMessages` (verified wire shape), and a
 * send runs through the store's split `beginSend` → one render boundary
 * → `dispatchSend` flow (#507): the optimistic pending row is rendered
 * BEFORE the POST is issued (U5 observable pending phase; the mechanism
 * was activated on the live send path by founder-authorized #499).
 * Retry posts `.../messages/:messageId/retry` with exactly-once click
 * tracking (`retriedMessageIds`, React parity). The status UX rides the
 * HTTP append path (U3 — no envelope "fix", no new behavior); W11/W12
 * stay parity-of-absence (no status/priority UI).
 *
 * RBAC (T2 §3.6): `canReplyAndRetry` — SUPER_ADMIN/ADMIN/MANAGER can
 * always reply+retry; USER only when assigned to this conversation
 * (`AuthService` + the conversation detail signals; UX-only — the
 * backend remains the security boundary).
 *
 * The right panel is #379's `app-right-panel` consumed as-is; its
 * `assignmentChange`/`tagsChange` outputs refetch the conversation
 * detail (React `invalidateQueries(['conversation', id])` parity).
 * W17 REST dispositions: no notifications REST UI (socket-fed; U1).
 */
@Component({
  selector: 'app-conversation',
  imports: [RouterLink, ReplyComposer, RightPanel],
  templateUrl: './conversation.html',
})
export class Conversation {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly conversationsStore = inject(ConversationsStore);
  private readonly messagesStore = inject(MessagesStore);
  private readonly auth = inject(AuthService);
  private readonly subscriptions = inject(ConversationSubscriptionService);

  protected readonly user = this.auth.user;
  protected readonly authLoading = this.auth.isLoading;

  /** In-page sidebar (React ConversationPage's own `sidebarOpen`). */
  protected readonly sidebarOpen = signal(false);

  /** Conversation id from the route (React `useParams` parity; UUID strings). */
  private readonly conversationIdSignal = signal<string | null>(null);
  protected readonly conversationId = this.conversationIdSignal.asReadonly();

  /** Detail resource snapshot (null while no id / entry not created). */
  protected readonly detailSnapshot = computed<ResourceSnapshot<ConversationDetail> | null>(() => {
    const conversationId = this.conversationId();
    return conversationId !== null
      ? (this.conversationsStore.detailSnapshot(conversationId) ?? null)
      : null;
  });

  /** Messages resource snapshot (null while no id / entry not created). */
  protected readonly messagesSnapshot = computed(() => {
    const conversationId = this.conversationId();
    return conversationId !== null ? (this.messagesStore.listSnapshot(conversationId) ?? null) : null;
  });

  /** Loaded conversation detail, if any. */
  protected readonly conversation = computed<ConversationDetail | null>(
    () => this.detailSnapshot()?.data ?? null,
  );

  /** Loaded message rows. */
  protected readonly messages = computed<Message[]>(
    () => this.messagesSnapshot()?.data?.messages ?? [],
  );

  /** First detail load with nothing to show yet (TanStack `isLoading`). */
  protected readonly isLoadingDetail = computed(
    () => (this.detailSnapshot()?.loading ?? false) && this.conversation() === null,
  );

  /** Any detail fetch in flight (TanStack `isFetching`). */
  protected readonly isFetchingDetail = computed(
    () =>
      (this.detailSnapshot()?.loading ?? false) || (this.detailSnapshot()?.refetching ?? false),
  );

  protected readonly detailError = computed(() => this.detailSnapshot()?.error ?? null);

  /** React `error?.error || error?.message || fallback` parity on the delivered helper. */
  protected readonly errorMessage = computed(() =>
    apiErrorMessage(this.detailError(), 'Failed to load conversation'),
  );

  protected readonly messagesLoading = computed(() => this.messagesSnapshot()?.loading ?? false);

  // ---- Reply send state (React `sendMessageMutation` projection) ----
  protected readonly isSending = signal(false);
  protected readonly sendError = signal<string | null>(null);

  /** Exactly-once retry click tracking (React `retriedMessageIds`). */
  private readonly retriedMessageIds = signal<ReadonlySet<string>>(new Set());

  protected readonly statusBadge = STATUS_BADGE;
  protected readonly priorityBadge = PRIORITY_BADGE;

  constructor() {
    // Route param → id signal (React `useParams` parity; survives
    // component reuse across `/conversations/:id` navigations).
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        this.conversationIdSignal.set(id && id.length > 0 ? id : null);
        // #499 AC-1: the open conversation is the subscription owner's
        // active interest — subscribe on open, and on a switch (component
        // reuse) the service unsubscribes the previous id BEFORE
        // subscribing this one. Component destroy releases it (leave).
        this.subscriptions.setActive(id && id.length > 0 ? id : null);
      });
    this.destroyRef.onDestroy(() => this.subscriptions.setActive(null));

    // React resize parity: the in-page sidebar opens on large screens.
    const checkScreenSize = (): void => {
      this.sidebarOpen.set(window.innerWidth >= 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', checkScreenSize));

    // Load the detail + the messages list once per conversation id
    // (React `enabled: !!conversationId` parity). The trigger fires once
    // per id; snapshot updates re-run the tracked computeds above for
    // the display state but must NOT re-fetch — errors stay terminal
    // until the explicit Retry control.
    effect(() => {
      const conversationId = this.conversationId();
      if (conversationId !== null) {
        void untracked(() => {
          void this.conversationsStore.loadDetail(conversationId);
          void this.messagesStore.loadMessages(conversationId);
        });
      }
    });
  }

  /**
   * Reply + retry RBAC (React `canReplyAndRetry` parity): staff roles
   * always; USER only when assigned to this conversation.
   */
  protected readonly canReplyAndRetry = computed<boolean>(() => {
    const user = this.auth.user();
    if (!user) {
      return false;
    }
    const role = user.role;
    // super_admin, admin, manager can reply+retry on all conversations
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER') {
      return true;
    }
    // USER role can only reply+retry if assigned to this conversation
    if (role === 'USER') {
      return this.conversation()?.assignedUserId === user.id;
    }
    return false;
  });

  /** Whether this message still shows its (enabled) retry control. */
  protected canRetryMessage(message: Message): boolean {
    return this.canReplyAndRetry() && !this.retriedMessageIds().has(message.id);
  }

  protected hasAlreadyRetried(message: Message): boolean {
    return this.retriedMessageIds().has(message.id);
  }

  /**
   * Send a reply through the store's split send (React
   * `sendMessageMutation.mutateAsync` parity): `beginSend` creates the
   * optimistic pending row, then exactly ONE Angular render boundary is
   * awaited (`afterNextRender` — one-shot, rAF-aligned scheduling; never
   * a fixed timeout, #507) so the pending state is rendered before
   * `dispatchSend` issues the POST. The composer clears the draft on
   * success and keeps it on failure; the typed error lands in
   * `sendError` and is surfaced by the composer's alert. Bound as a
   * field arrow so the function-value `onSend` binding keeps `this`.
   */
  protected readonly sendMessage = async (body: string): Promise<void> => {
    const conversationId = this.conversationId();
    if (conversationId === null) {
      return;
    }
    this.isSending.set(true);
    this.sendError.set(null);
    try {
      const tempId = this.messagesStore.beginSend(conversationId, { body });
      if (tempId !== null) {
        // #507: render the pending row before the request goes out. On a
        // not-yet-loaded list there is no row to render (beginSend
        // returned null) — dispatch directly (pre-#499 behavior).
        await this.renderBoundary();
      }
      await this.messagesStore.dispatchSend(conversationId, tempId, { body });
    } catch (err: unknown) {
      this.sendError.set(apiErrorMessage(err, 'Failed to send message'));
      // React `mutateAsync` rejection parity: the composer keeps the
      // draft and logs only when the promise rejects.
      throw err;
    } finally {
      this.isSending.set(false);
    }
  };

  /** The awaited one-render-boundary primitive (#507; see `RENDER_BOUNDARY`). */
  private readonly renderBoundary = inject(RENDER_BOUNDARY);

  /** Dismiss the send error (React `sendMessageMutation.reset()` parity). */
  protected dismissSendError(): void {
    this.sendError.set(null);
  }

  /**
   * Retry a failed message — exactly-once click tracking FIRST (React
   * order: the id is recorded before the call so a failure cannot
   * re-enable the button), then the store's retry (patches the row and
   * invalidates the conversations family). Status updates ride the
   * server response / wired WS handlers (U3 — no new behavior).
   */
  protected async handleMessageRetry(messageId: string): Promise<void> {
    const conversationId = this.conversationId();
    if (conversationId === null) {
      return;
    }
    // #499 AC-6: the retry endpoint is addressed by SERVER message ids
    // only — an optimistic row still carrying its generated tempId has
    // no server row to retry, so the click path is guarded to server-id
    // rows (isTempId) and never sends a temp id to the endpoint.
    if (isTempId(messageId)) {
      return;
    }
    // P0: Track that user has clicked retry for this message (exactly once)
    this.retriedMessageIds.update((previous) => new Set(previous).add(messageId));
    try {
      await this.messagesStore.retryMessage(conversationId, messageId);
    } catch (err: unknown) {
      console.error('Retry failed:', err instanceof Error ? err.message : String(err));
    }
  }

  /**
   * Right-panel assignment change → refetch the conversation detail
   * (React `invalidateQueries({ queryKey: ['conversation', id] })`
   * parity — the invalidation refetches the loaded entry).
   */
  protected onAssignmentChange(): void {
    const conversationId = this.conversationId();
    if (conversationId !== null) {
      this.conversationsStore.invalidateDetail(conversationId);
    }
  }

  /** Right-panel tags change → same detail refetch (React parity). */
  protected onTagsChange(): void {
    this.onAssignmentChange();
  }

  protected refetchDetail(): void {
    const conversationId = this.conversationId();
    if (conversationId !== null) {
      void this.conversationsStore.loadDetail(conversationId);
    }
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  /** Navbar avatar initial (React `user?.name?.charAt(0).toUpperCase()` parity). */
  protected avatarInitial(): string {
    return this.user()?.name.charAt(0).toUpperCase() || 'U';
  }

  /** Locale timestamp (React `formatTimestamp` parity). */
  protected formatTimestamp(value?: string | null): string {
    if (!value) {
      return 'N/A';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'N/A';
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected channelLabel(channel: string): string {
    return CHANNEL_LABELS[channel as ChannelType] ?? channel;
  }

  protected async handleLogout(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch {
      // State is cleared unconditionally by AuthService.
    }
    // React `ProtectedRoute` redirect parity (the delivered inbox
    // pattern): the cleared identity lands on /login.
    await this.router.navigateByUrl('/login');
  }
}
