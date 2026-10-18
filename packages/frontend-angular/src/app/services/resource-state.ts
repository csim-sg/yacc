import { signal, type Signal, type WritableSignal } from '@angular/core';

import type { CacheKey } from '../contracts/cache-keys';

/** Freshness window: an entry younger than 30s is served without HTTP. */
const FRESH_MS = 30 * 1000;

/** Lazy eviction window: an entry idle for 5m is dropped on next access. */
const EVICT_MS = 5 * 60 * 1000;

/**
 * Observable state of one cache entry (T2 §3.1). `loading` = first load
 * (no data yet); `refetching` = background refresh while stale data stays
 * served (stale-while-revalidate + keep-previous).
 */
export interface ResourceSnapshot<T> {
  readonly data: T | undefined;
  readonly loading: boolean;
  readonly refetching: boolean;
  readonly error: unknown;
}

interface Entry<T> {
  /** Original canonical key — prefix matching for `invalidate()`. */
  key: CacheKey;
  state: WritableSignal<ResourceSnapshot<T>>;
  /** Epoch ms of the last successful fetch or sync `update()`. */
  fetchedAt: number;
  /** Epoch ms of the last read — drives lazy eviction (gcTime parity). */
  accessedAt: number;
  /** Last fetcher seen for this key — replays invalidate-triggered refetches. */
  fetcher: (() => Promise<T>) | null;
}

/**
 * The ONE internal typed helper behind every resource store (T2 §3.1;
 * ARCH-005 §3.1). Deliberately SMALL — freshness + dedup + invalidation
 * only; it is not a state framework.
 *
 * Per-family generic instances (`new ResourceState<FamilyResponse>()`)
 * keep the cache type-sound without casts (TR-06): the fetcher's return
 * type flows into the stored snapshot. Cross-family invalidation is done
 * by the owning store calling its instances' `invalidate*()` — mirroring
 * today's per-store mutation mapping (B4).
 *
 * Semantics (TanStack Query parity, verified behaviors B1/B3/B4):
 * - 30s freshness gate — `load()` inside the window returns cached data
 *   with no HTTP call.
 * - Stale-while-revalidate + keep-previous — a stale entry is served
 *   while one background refresh runs; `data` never drops to undefined.
 * - Per-key in-flight dedup — concurrent `load()` calls share one request.
 * - 5m lazy eviction — an entry idle for 5m is dropped on next access
 *   (gcTime parity without a sweep timer).
 * - `invalidate()` — mark stale + refetch now (entries that were loaded;
 *   keys never loaded are left uncreated — same observable behavior as
 *   marking-inactive-queries-stale-only).
 * - `update()` — synchronous patch (React `setQueryData` parity: the
 *   patched data becomes fresh).
 */
export class ResourceState<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  /** Read one entry's snapshot without creating it. */
  snapshot(key: CacheKey): ResourceSnapshot<T> | undefined {
    return this.entries.get(ResourceState.serialize(key))?.state();
  }

  /** Reactive handle on one entry's snapshot, if the entry exists. */
  watch(key: CacheKey): Signal<ResourceSnapshot<T>> | undefined {
    return this.entries.get(ResourceState.serialize(key))?.state.asReadonly();
  }

  /**
   * Load a key through `fetcher` with the freshness gate, per-key dedup
   * and stale-while-revalidate semantics. Resolves with the data; rejects
   * when this caller's fetch attempt failed (state carries the typed
   * error — callers may render it instead of catching).
   */
  async load(key: CacheKey, fetcher: () => Promise<T>): Promise<T> {
    const serialized = ResourceState.serialize(key);
    const now = Date.now();

    // Lazy eviction: an entry idle for 5m is dropped on next access.
    const existing = this.entries.get(serialized);
    if (existing && now - existing.accessedAt > EVICT_MS) {
      this.entries.delete(serialized);
    }

    const entry = this.ensureEntry(key);
    entry.accessedAt = Date.now();

    // Freshness gate: served from cache, no HTTP call.
    const current = entry.state();
    if (
      current.data !== undefined &&
      !current.loading &&
      entry.fetchedAt > 0 &&
      Date.now() - entry.fetchedAt < FRESH_MS
    ) {
      return current.data;
    }

    // Per-key in-flight dedup: concurrent callers join the shared request.
    const running = this.inFlight.get(serialized);
    if (running) {
      entry.accessedAt = Date.now();
      return running;
    }

    const stale = current.data !== undefined;
    entry.state.set({
      data: current.data,
      loading: !stale,
      refetching: stale,
      error: null,
    });
    entry.fetcher = fetcher;

    const request = fetcher().then(
      (data) => {
        entry.state.set({ data, loading: false, refetching: false, error: null });
        entry.fetchedAt = Date.now();
        entry.accessedAt = entry.fetchedAt;
        return data;
      },
      (error: unknown) => {
        // Keep previous data on failure (keep-previous parity).
        entry.state.set({
          data: entry.state().data,
          loading: false,
          refetching: false,
          error,
        });
        throw error;
      },
    );
    this.inFlight.set(serialized, request);
    request
      // Background refetches may have no awaiting caller — silence the
      // engine's unhandled-rejection path; the error lives in the state.
      .catch(() => undefined)
      .finally(() => {
        if (this.inFlight.get(serialized) === request) {
          this.inFlight.delete(serialized);
        }
      });
    return request;
  }

  /**
   * Mark entries matching `prefix` stale and refetch the loaded ones now
   * (background, keep-previous). Without a prefix every loaded entry of
   * this instance is invalidated — the per-store invalidation unit.
   */
  invalidate(prefix?: CacheKey): void {
    for (const [serialized, entry] of this.entries) {
      if (prefix && !ResourceState.startsWith(entry.key, prefix)) {
        continue;
      }
      if (!entry.fetcher || this.inFlight.has(serialized)) {
        continue;
      }
      // Mark stale first so the refetch bypasses the freshness gate
      // (React invalidateQueries parity), then refetch in the background.
      entry.fetchedAt = 0;
      void this.load(entry.key, entry.fetcher);
    }
  }

  /**
   * Synchronous patch (React `setQueryData` parity: result is fresh).
   * Returning `undefined` leaves the entry unchanged (nothing loaded to
   * patch — the confirmed result arrives via the next load).
   */
  update(key: CacheKey, patch: (previous: T | undefined) => T | undefined): void {
    const entry = this.ensureEntry(key);
    const next = patch(entry.state().data);
    if (next === undefined) {
      return;
    }
    entry.state.set({
      data: next,
      loading: false,
      refetching: false,
      error: null,
    });
    entry.fetchedAt = Date.now();
    entry.accessedAt = entry.fetchedAt;
  }

  private ensureEntry(key: CacheKey): Entry<T> {
    const serialized = ResourceState.serialize(key);
    let entry = this.entries.get(serialized);
    if (!entry) {
      entry = {
        key,
        state: signal<ResourceSnapshot<T>>({
          data: undefined,
          loading: false,
          refetching: false,
          error: null,
        }),
        fetchedAt: 0,
        accessedAt: Date.now(),
        fetcher: null,
      };
      this.entries.set(serialized, entry);
    }
    return entry;
  }

  private static serialize(key: CacheKey): string {
    return JSON.stringify(key);
  }

  private static startsWith(key: CacheKey, prefix: CacheKey): boolean {
    return prefix.length <= key.length && prefix.every((part, index) => key[index] === part);
  }
}
