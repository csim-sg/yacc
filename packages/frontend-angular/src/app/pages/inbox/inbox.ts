import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type {
  ChannelType,
  ConversationPriority,
  ConversationStatus,
  ListConversationsParams,
  ListConversationsResponse,
} from '../../contracts/http/conversations.schema';
import type { ResourceSnapshot } from '../../services/resource-state';
import { UnreadBadge } from '../../components/unread-badge/unread-badge';
import { apiErrorMessage } from '../../lib/api-error-message';
import { AuthService } from '../../services/auth.service';
import { ConversationsStore } from '../../services/conversations.store';

/** Page size (React `pageSize`). */
const PAGE_SIZE = 20;

/** Phase-1 filter surface (React `PHASE1_CHANNELS` parity). */
const PHASE1_CHANNELS: ChannelType[] = ['telegram', 'irc'];

/** Channel display labels (React `CHANNEL_LABELS` parity). */
const CHANNEL_LABELS: Partial<Record<ChannelType, string>> = {
  telegram: 'Telegram',
  irc: 'IRC',
};

/** Status → daisyUI badge class (React `STATUS_BADGE` parity). */
const STATUS_BADGE: Record<ConversationStatus, string> = {
  open: 'badge-success',
  pending: 'badge-warning',
  resolved: 'badge-neutral',
};

/** Priority → daisyUI badge class (React `PRIORITY_BADGE` parity). */
const PRIORITY_BADGE: Record<ConversationPriority, string> = {
  low: 'badge-ghost',
  normal: 'badge-info',
  high: 'badge-warning',
  urgent: 'badge-error',
};

type ChannelFilter = ChannelType | 'all';
type StatusFilter = ConversationStatus | 'all';
type PriorityFilter = ConversationPriority | 'all';

/**
 * Inbox Page (React `pages/InboxPage.tsx` port — W5/W6).
 *
 * Conversation list with filters/search/pagination against
 * `GET /api/conversations` through the canonical `ConversationsStore`:
 * URL query params initialize the filters once and are written back
 * (replace) on change; a filter change resets to page 1; the list never
 * drops to empty while a background load runs (keep-previous — the last
 * loaded response stays displayed until the new one lands).
 *
 * W6: every conversation card renders `UnreadBadge` from the row's
 * `unreadCount`; opening a conversation clears it optimistically via the
 * store-owned `markAsRead` cache patch. The `message.received` badge
 * refresh rides ANG-006's conversations-list invalidation; the React
 * `incrementUnreadCount` local-increment path is unwired live and is
 * recorded as parity-of-absence (ANG-015 register).
 *
 * W13/W17 REST dispositions: no bulk-actions UI and no notifications
 * REST UI is built (parity of absence, U4) — the store manifest keeps
 * those contracts API-only.
 */
@Component({
  selector: 'app-inbox',
  imports: [UnreadBadge],
  templateUrl: './inbox.html',
})
export class Inbox {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly conversationsStore = inject(ConversationsStore);
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.user;
  protected readonly authLoading = this.auth.isLoading;

  // ---- Filter state (React `useState` group) ----
  protected readonly page = signal(1);
  protected readonly channel = signal<ChannelFilter>('all');
  protected readonly status = signal<StatusFilter>('all');
  protected readonly priority = signal<PriorityFilter>('all');
  protected readonly searchInput = signal('');
  protected readonly search = signal('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');
  protected readonly unreadOnly = signal(false);

  /** In-page sidebar (React InboxPage's own `sidebarOpen`). */
  protected readonly sidebarOpen = signal(false);

  // ---- Resource snapshot state (keep-previous display) ----
  private readonly snapshotSignal = signal<ResourceSnapshot<ListConversationsResponse> | null>(null);
  private readonly lastData = signal<ListConversationsResponse | undefined>(undefined);
  /** Param key the load was last triggered for (effect loop guard). */
  private loadedParams: ListConversationsParams | null = null;

  /** Snapshot of the currently displayed list entry, if any. */
  protected readonly snapshot = this.snapshotSignal.asReadonly();

  protected readonly statusBadge = STATUS_BADGE;
  protected readonly priorityBadge = PRIORITY_BADGE;
  protected readonly statusValues: ConversationStatus[] = ['open', 'pending', 'resolved'];
  protected readonly priorityValues: ConversationPriority[] = ['low', 'normal', 'high', 'urgent'];

  constructor() {
    // W5: initialize the filters from the URL exactly once (React
    // `initializedFromUrl` effect parity) — invalid values fall back to
    // their defaults.
    const params = this.route.snapshot.queryParamMap;
    const pageParam = Number(params.get('page') || 1);
    this.page.set(Number.isNaN(pageParam) ? 1 : pageParam);
    const channelParam = params.get('channel');
    this.channel.set(
      PHASE1_CHANNELS.includes(channelParam as ChannelType) ? (channelParam as ChannelType) : 'all',
    );
    const statusParam = params.get('status');
    this.status.set(
      this.statusValues.includes(statusParam as ConversationStatus) ? (statusParam as ConversationStatus) : 'all',
    );
    const priorityParam = params.get('priority');
    this.priority.set(
      this.priorityValues.includes(priorityParam as ConversationPriority)
        ? (priorityParam as ConversationPriority)
        : 'all',
    );
    this.search.set(params.get('search') || '');
    this.searchInput.set(params.get('search') || '');
    this.dateFrom.set(params.get('dateFrom') || '');
    this.dateTo.set(params.get('dateTo') || '');
    this.unreadOnly.set(params.get('unread') === 'true');

    // React resize parity: the in-page sidebar opens on large screens.
    const checkScreenSize = (): void => {
      this.sidebarOpen.set(window.innerWidth >= 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    this.destroyRef.onDestroy(() => window.removeEventListener('resize', checkScreenSize));

    // W5: load the displayed list entry. `loadList` creates the cache
    // entry synchronously, so the tracked snapshot read below observes
    // loading → data/error transitions for exactly this key. The trigger
    // fires once per param key (identity-stable computed): snapshot
    // updates re-run this effect for the display state but must NOT
    // re-fetch — errors stay terminal until the explicit Retry control.
    effect(() => {
      const listParams = this.listParams();
      if (this.loadedParams !== listParams) {
        this.loadedParams = listParams;
        void untracked(() => this.conversationsStore.loadList(listParams));
      }
      const snapshot = this.conversationsStore.listSnapshot(listParams) ?? null;
      untracked(() => {
        this.snapshotSignal.set(snapshot);
        if (snapshot?.data !== undefined) {
          this.lastData.set(snapshot.data);
        }
      });
    });

    // W5: write the non-default filters back to the URL (replace) —
    // React `setSearchParams(params, { replace: true })` parity.
    effect(() => {
      const queryParams: Record<string, string> = {};
      if (this.page() > 1) {
        queryParams['page'] = String(this.page());
      }
      if (this.channel() !== 'all') {
        queryParams['channel'] = this.channel();
      }
      if (this.status() !== 'all') {
        queryParams['status'] = this.status();
      }
      if (this.priority() !== 'all') {
        queryParams['priority'] = this.priority();
      }
      if (this.search()) {
        queryParams['search'] = this.search();
      }
      if (this.dateFrom()) {
        queryParams['dateFrom'] = this.dateFrom();
      }
      if (this.dateTo()) {
        queryParams['dateTo'] = this.dateTo();
      }
      if (this.unreadOnly()) {
        queryParams['unread'] = 'true';
      }
      untracked(() => void this.router.navigate([], { relativeTo: this.route, queryParams }));
    });
  }

  /** GET /api/conversations params for the current filters. */
  protected readonly listParams = computed(() => {
    const params: ListConversationsParams = {
      page: this.page(),
      limit: PAGE_SIZE,
      sortBy: 'lastActivity',
      sortOrder: 'desc',
    };
    const channel = this.channel();
    const status = this.status();
    const priority = this.priority();
    if (channel !== 'all') {
      params.channel = channel;
    }
    if (status !== 'all') {
      params.status = status;
    }
    if (priority !== 'all') {
      params.priority = priority;
    }
    if (this.search()) {
      params.search = this.search();
    }
    if (this.dateFrom()) {
      params.dateFrom = this.dateFrom();
    }
    if (this.dateTo()) {
      params.dateTo = this.dateTo();
    }
    if (this.unreadOnly()) {
      params.unread = true;
    }
    return params;
  });

  // ---- Display projections (keep-previous: data never drops to empty) ----

  /** Displayed response — current snapshot data, else the previous one. */
  protected readonly displayData = computed<ListConversationsResponse | undefined>(
    () => this.snapshot()?.data ?? this.lastData(),
  );

  /** First load with nothing to show yet (TanStack `isLoading` parity). */
  protected readonly isLoadingFirst = computed(
    () => (this.snapshot()?.loading ?? false) && this.displayData() === undefined,
  );

  /** Any fetch in flight (TanStack `isFetching` parity). */
  protected readonly isFetching = computed(
    () => (this.snapshot()?.loading ?? false) || (this.snapshot()?.refetching ?? false),
  );

  protected readonly listError = computed(() => this.snapshot()?.error ?? null);

  /** React `error?.error || error?.message || fallback` parity on the delivered helper. */
  protected readonly errorMessage = computed(() =>
    apiErrorMessage(this.listError(), 'Failed to load conversations'),
  );

  protected readonly conversations = computed(() => this.displayData()?.data ?? []);
  protected readonly totalCount = computed(() => this.displayData()?.total ?? 0);
  protected readonly responsivePageSize = computed(() => this.displayData()?.limit ?? PAGE_SIZE);
  protected readonly totalPages = computed(() =>
    Math.ceil(this.totalCount() / this.responsivePageSize()),
  );

  /** Active filter chips (React `activeFilters` parity). */
  protected readonly activeFilters = computed(() => {
    const filters: Array<{ label: string; onClear: () => void }> = [];
    const channel = this.channel();
    if (channel !== 'all') {
      filters.push({
        label: `Channel: ${CHANNEL_LABELS[channel] ?? channel}`,
        onClear: () => this.setChannelFilter('all'),
      });
    }
    if (this.status() !== 'all') {
      filters.push({ label: `Status: ${this.status()}`, onClear: () => this.setStatusFilter('all') });
    }
    if (this.priority() !== 'all') {
      filters.push({
        label: `Priority: ${this.priority()}`,
        onClear: () => this.setPriorityFilter('all'),
      });
    }
    if (this.search()) {
      filters.push({ label: `Search: ${this.search()}`, onClear: () => this.clearSearch() });
    }
    if (this.dateFrom() || this.dateTo()) {
      filters.push({
        label: `Date: ${this.dateFrom() || 'Any'} → ${this.dateTo() || 'Any'}`,
        onClear: () => this.clearDates(),
      });
    }
    if (this.unreadOnly()) {
      filters.push({ label: 'Unread only', onClear: () => this.setUnreadOnly(false) });
    }
    return filters;
  });

  // ---- Handlers (a filter change resets to page 1 — React effect parity) ----

  protected setChannelFilter(value: ChannelFilter): void {
    if (this.channel() === value) {
      return;
    }
    this.channel.set(value);
    this.page.set(1);
  }

  protected onChannelFilterChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      this.setChannelFilter(PHASE1_CHANNELS.includes(value as ChannelType) ? (value as ChannelType) : 'all');
    }
  }

  protected onStatusFilterChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      this.setStatusFilter(
        this.statusValues.includes(value as ConversationStatus) ? (value as ConversationStatus) : 'all',
      );
    }
  }

  protected onPriorityFilterChange(event: Event): void {
    if (event.target instanceof HTMLSelectElement) {
      const value = event.target.value;
      this.setPriorityFilter(
        this.priorityValues.includes(value as ConversationPriority) ? (value as ConversationPriority) : 'all',
      );
    }
  }

  /** Sidebar channel button (closes the drawer on small screens). */
  protected handleChannelSelect(value: ChannelFilter): void {
    this.setChannelFilter(value);
    if (window.innerWidth < 1024) {
      this.sidebarOpen.set(false);
    }
  }

  protected setStatusFilter(value: StatusFilter): void {
    if (this.status() === value) {
      return;
    }
    this.status.set(value);
    this.page.set(1);
  }

  protected setPriorityFilter(value: PriorityFilter): void {
    if (this.priority() === value) {
      return;
    }
    this.priority.set(value);
    this.page.set(1);
  }

  protected setUnreadOnly(value: boolean): void {
    if (this.unreadOnly() === value) {
      return;
    }
    this.unreadOnly.set(value);
    this.page.set(1);
  }

  protected onDateFromChange(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.value : '';
    if (this.dateFrom() === value) {
      return;
    }
    this.dateFrom.set(value);
    this.page.set(1);
  }

  protected onDateToChange(event: Event): void {
    const value = event.target instanceof HTMLInputElement ? event.target.value : '';
    if (this.dateTo() === value) {
      return;
    }
    this.dateTo.set(value);
    this.page.set(1);
  }

  protected onSearchInput(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.searchInput.set(event.target.value);
    }
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.submitSearch();
    }
  }

  protected onUnreadOnlyChange(event: Event): void {
    this.setUnreadOnly(event.target instanceof HTMLInputElement ? event.target.checked : false);
  }

  /** Search submit (Enter or button): trimmed value becomes the filter. */
  protected submitSearch(): void {
    const next = this.searchInput().trim();
    if (next === this.search()) {
      return;
    }
    this.search.set(next);
    this.page.set(1);
  }

  protected clearSearch(): void {
    if (this.search() === '' && this.searchInput() === '') {
      return;
    }
    this.search.set('');
    this.searchInput.set('');
    this.page.set(1);
  }

  protected clearDates(): void {
    if (this.dateFrom() === '' && this.dateTo() === '') {
      return;
    }
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(1);
  }

  protected clearAllFilters(): void {
    const changed =
      this.channel() !== 'all' ||
      this.status() !== 'all' ||
      this.priority() !== 'all' ||
      this.search() !== '' ||
      this.searchInput() !== '' ||
      this.dateFrom() !== '' ||
      this.dateTo() !== '' ||
      this.unreadOnly();
    this.channel.set('all');
    this.status.set('all');
    this.priority.set('all');
    this.search.set('');
    this.searchInput.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.unreadOnly.set(false);
    if (changed) {
      this.page.set(1);
    }
  }

  protected previousPage(): void {
    this.page.update((current) => Math.max(1, current - 1));
  }

  protected nextPage(): void {
    this.page.update((current) => Math.min(this.totalPages(), current + 1));
  }

  protected refetch(): void {
    // eslint-disable-next-line no-console
    console.log('REFETCH_CALLED');
    const snap = this.conversationsStore.listSnapshot(this.listParams());
    // eslint-disable-next-line no-console
    console.log('REFETCH_SNAP loading=', snap?.loading, 'hasData=', snap?.data !== undefined, 'hasError=', snap?.error != null);
    void this.conversationsStore.loadList(this.listParams());
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  /**
   * W6: opening a conversation clears its badge optimistically (the
   * store-owned cache patch — no HTTP), then navigates to the
   * conversation route.
   */
  protected handleConversationClick(conversationId: string): void {
    if (conversationId) {
      this.conversationsStore.markAsRead(conversationId, this.listParams());
    }
    void this.router.navigateByUrl(`/conversations/${conversationId}`);
  }

  /**
   * Navbar logout (no confirmation here — React `InboxPage` parity): the
   * sign-out clears the identity; the `/login` navigation reproduces the
   * `ProtectedRoute` redirect the cleared identity triggers in React.
   */
  protected async handleLogout(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch {
      // State is cleared unconditionally by AuthService.
    }
    await this.router.navigateByUrl('/login');
  }

  protected channelLabel(channel: string): string {
    return CHANNEL_LABELS[channel as ChannelType] ?? channel;
  }

  /** React `formatTimestamp` parity. */
  protected formatTimestamp(value?: string | null): string {
    if (!value) {
      return 'No activity';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'No activity';
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Navbar avatar initial (React parity). */
  protected avatarInitial(): string {
    return this.user()?.name.charAt(0).toUpperCase() || 'U';
  }

  /** Account-card member-since date (React parity). */
  protected memberSince(): string {
    const createdAt = this.user()?.createdAt;
    return createdAt ? new Date(createdAt).toLocaleDateString() : 'N/A';
  }

  /** Account-card role label (React single-underscore replace parity). */
  protected roleLabel(): string {
    return this.user()?.role.replace('_', ' ') ?? '';
  }
}
