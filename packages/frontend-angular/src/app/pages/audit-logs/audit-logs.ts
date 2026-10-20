import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import type {
  AuditLog,
  ListAuditLogsParams,
  ListAuditLogsResponse,
} from '../../contracts/http/audit-logs.schema';
import { apiErrorMessage } from '../../lib/api-error-message';
import type { ResourceSnapshot } from '../../services/resource-state';
import { AuditLogsStore } from '../../services/audit-logs.store';

/** React `limit: 20` — the page's fixed page size. */
const PAGE_SIZE = 20;

/** React `Math.min(5, totalPages)` — at most five page-number buttons. */
const MAX_PAGE_BUTTONS = 5;

/** Fields of the React `filters` `useState` object. */
type AuditFilterField = 'action' | 'entityType' | 'dateFrom' | 'dateTo';

/**
 * Audit Logs page (React `pages/AuditLogsPage.tsx` port — W18).
 *
 * Compliance/observability list over the canonical store: the list rides
 * `AuditLogsStore.loadLogs` keyed on filters+page (React
 * `useQuery(['audit-logs', page, filters])` — per-key cache, 30s-fresh
 * repeat keys are store cache hits, TanStack staleTime parity). Filters
 * are free-text/date inputs that refetch per keystroke/pick WITHOUT a
 * page reset (React `setFilters({...filters, field: value})` parity);
 * empty values are dropped from the query string by the shared
 * `toHttpParams` helper (React `buildQueryString` parity). The
 * conversation-scoped query stays a store/service-level surface
 * (`AuditLogsStore.loadConversationLogs`, store-spec covered) — React's
 * `queryByConversation` has no page caller (parity-of-absence).
 *
 * U4 (fixed disposition — API-only parity): `POST /api/audit-logs/export`
 * is recorded as API-only per T1 §6 W18 ("exists — no frontend caller")
 * and the contracts manifest ("consumer: none | gap (G8 — API-only)").
 * The page renders NO export UI and never calls `AuditLogsStore.export`;
 * React's export button/error surface is not ported.
 *
 * RBAC: the route carries `roleGuard('MANAGER')` (React
 * `ProtectedRoute requiredRole="MANAGER"` parity — hierarchy semantics,
 * so SUPER_ADMIN/ADMIN/MANAGER pass and USER is bounced to `/inbox`);
 * UX only, the backend `@Authorized` stays the security boundary. The
 * page body has no further in-component role gate (React parity).
 */
@Component({
  selector: 'app-audit-logs',
  imports: [RouterLink],
  templateUrl: './audit-logs.html',
})
export class AuditLogs {
  private readonly store = inject(AuditLogsStore);

  /** React `filters` — raw input values ('' = unfiltered). */
  protected readonly filters = signal<Record<AuditFilterField, string>>({
    action: '',
    entityType: '',
    dateFrom: '',
    dateTo: '',
  });

  /** React `page` — starts at 1. */
  protected readonly page = signal(1);

  /** React `useQuery(['audit-logs', page, filters])` — one key. */
  private readonly listParams = computed<ListAuditLogsParams>(() => ({
    ...this.filters(),
    page: this.page(),
    limit: PAGE_SIZE,
  }));

  /** List resource snapshot (null while the key's first load is pending). */
  protected readonly listSnapshot = computed<ResourceSnapshot<ListAuditLogsResponse> | null>(
    () => this.store.listSnapshot(this.listParams()) ?? null,
  );

  /** First load with nothing to show yet (React `isLoading` parity). */
  protected readonly isLoading = computed(() => {
    const snapshot = this.listSnapshot();
    return snapshot === null || (snapshot.loading && snapshot.data === undefined);
  });

  protected readonly hasListError = computed(() => this.listSnapshot()?.error != null);

  /** React `queryError instanceof Error ? message : fallback` on the delivered helper. */
  protected readonly errorMessage = computed(() =>
    apiErrorMessage(this.listSnapshot()?.error, 'Failed to load audit logs'),
  );

  /** Loaded rows (wire `BaseListResponse.data` — D5 drift row). */
  protected readonly logs = computed<AuditLog[]>(() => this.listSnapshot()?.data?.data ?? []);

  /** React `logsData?.total || 0` — the wire total. */
  protected readonly total = computed(() => this.listSnapshot()?.data?.total ?? 0);

  /**
   * React `logsData?.pages || 1` — computed from the wire `total` (the
   * `BaseListResponse` carries no `pages` field — D5 drift row).
   */
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / PAGE_SIZE)),
  );

  /** React `Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1)`. */
  protected readonly pageButtons = computed(() =>
    Array.from({ length: Math.min(MAX_PAGE_BUTTONS, this.totalPages()) }, (_, i) => i + 1),
  );

  constructor() {
    // React `useQuery` parity: one list load per (filters+page) key;
    // 30s-fresh repeat keys are store cache hits (TanStack staleTime
    // parity).
    effect(() => {
      const params = this.listParams();
      void untracked(() => {
        void this.store.loadLogs(params);
      });
    });
  }

  /**
   * React `setFilters({ ...filters, field: value })` — the key changes
   * and the list refetches; the page is deliberately NOT reset (React
   * parity).
   */
  protected onFilterChange(field: AuditFilterField, event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      const value = event.target.value;
      this.filters.update((previous) => ({ ...previous, [field]: value }));
    }
  }

  /** React `setPage(Math.max(1, page - 1))`. */
  protected onPrevPage(): void {
    this.page.update((current) => Math.max(1, current - 1));
  }

  /** React `setPage(Math.min(totalPages, page + 1))`. */
  protected onNextPage(): void {
    this.page.update((current) => Math.min(this.totalPages(), current + 1));
  }

  /** React `setPage(pageNum)` on a numbered button. */
  protected onPage(pageNumber: number): void {
    this.page.set(pageNumber);
  }

  /** React `new Date(log.createdAt).toLocaleString()` parity. */
  protected formattedTimestamp(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  /** React `JSON.stringify(log.metadata, null, 2)` in the Details dropdown. */
  protected metadataJson(metadata: Record<string, unknown>): string {
    return JSON.stringify(metadata, null, 2);
  }
}
