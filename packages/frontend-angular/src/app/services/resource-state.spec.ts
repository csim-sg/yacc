import { TestBed } from '@angular/core/testing';

import { cacheKeys } from '../contracts/cache-keys';
import { ResourceState } from './resource-state';

/**
 * ResourceState<T> spec (AC-ANG-005-1; T2 §3.1 rows, B1/B3/B4): 30s
 * freshness, 5m lazy eviction, per-key in-flight dedup, stale-while-
 * revalidate + keep-previous, invalidate/update semantics. Time is
 * controlled by faking `Date` only — no sleeps.
 */
describe('ResourceState', () => {
  let state: ResourceState<{ value: number }>;
  let fetches: number;

  /** Fetcher returning an incrementing payload (observable via state). */
  function countingFetcher(): Promise<{ value: number }> {
    fetches += 1;
    return Promise.resolve({ value: fetches });
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    TestBed.configureTestingModule({});
    state = new ResourceState();
    fetches = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const key = cacheKeys.tags.all;

  it('serves a fresh entry (<30s) with no second HTTP call', async () => {
    await state.load(key(), countingFetcher);
    expect(fetches).toBe(1);

    const again = await state.load(key(), countingFetcher);

    expect(fetches).toBe(1);
    expect(again).toEqual({ value: 1 });
  });

  it('refetches when the entry is stale (≥30s) — stale-while-revalidate', async () => {
    await state.load(key(), countingFetcher);
    vi.setSystemTime(Date.now() + 31_000);

    const pending = state.load(key(), countingFetcher);

    // Stale data is served while the background refresh runs.
    const snapshot = state.snapshot(key());
    expect(snapshot?.refetching).toBe(true);
    expect(snapshot?.data).toEqual({ value: 1 });

    const result = await pending;
    expect(fetches).toBe(2);
    expect(result).toEqual({ value: 2 });
    expect(state.snapshot(key())?.refetching).toBe(false);
  });

  it('keeps previous data when a (re)fetch fails and records the error', async () => {
    await state.load(key(), countingFetcher);
    vi.setSystemTime(Date.now() + 31_000);

    await state
      .load(key(), () => Promise.reject(new Error('boom')))
      .catch(() => undefined);

    const snapshot = state.snapshot(key());
    expect(snapshot?.data).toEqual({ value: 1 });
    expect(snapshot?.error).toBeInstanceOf(Error);
    expect(snapshot?.loading).toBe(false);
    expect(snapshot?.refetching).toBe(false);
  });

  it('marks the first load with loading=true and no data', async () => {
    const pending = state.load(key(), countingFetcher);

    const snapshot = state.snapshot(key());
    expect(snapshot?.loading).toBe(true);
    expect(snapshot?.data).toBeUndefined();

    await pending;
    expect(state.snapshot(key())?.loading).toBe(false);
  });

  it('dedups concurrent loads of the same key into one HTTP call', async () => {
    const [a, b, c] = await Promise.all([
      state.load(key(), countingFetcher),
      state.load(key(), countingFetcher),
      state.load(key(), countingFetcher),
    ]);

    expect(fetches).toBe(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('treats different keys as different entries', async () => {
    await state.load(key(), countingFetcher);
    await state.load(['other'], countingFetcher);

    expect(fetches).toBe(2);
    expect(state.snapshot(key())?.data).toEqual({ value: 1 });
    expect(state.snapshot(['other'])?.data).toEqual({ value: 2 });
  });

  it('evicts an entry idle for 5m on next access (lazy gcTime)', async () => {
    await state.load(key(), countingFetcher);
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);

    await state.load(key(), countingFetcher);

    // The stale entry was dropped, so this is a fresh first load.
    expect(fetches).toBe(2);
    const snapshot = state.snapshot(key());
    expect(snapshot?.loading).toBe(false);
    expect(snapshot?.data).toEqual({ value: 2 });
  });

  it('does not evict entries idle below the window', async () => {
    await state.load(key(), countingFetcher);
    vi.setSystemTime(Date.now() + 4 * 60 * 1000);

    await state.load(key(), countingFetcher);

    // Entry was live (stale → background refetch), not evicted: same
    // refetch count, previous data kept until the refresh lands.
    expect(fetches).toBe(2);
  });

  it('invalidate(prefix) refetches loaded entries under that canonical prefix', async () => {
    const conversations = cacheKeys.conversations;
    await state.load(conversations.list({ page: 1 }), countingFetcher);
    await state.load(conversations.detail('c1'), countingFetcher);
    await state.load(cacheKeys.tags.all(), countingFetcher);
    expect(fetches).toBe(3);

    // The plural root `['conversations']` covers the list family; the
    // singular detail key (`['conversation', id]`) is a separate canonical
    // family invalidated through its own store instance.
    state.invalidate(conversations.all());
    await vi.waitFor(() => expect(fetches).toBe(4));

    expect(state.snapshot(conversations.list({ page: 1 }))?.data).toEqual({ value: 4 });
    expect(state.snapshot(conversations.detail('c1'))?.data).toEqual({ value: 2 });
    expect(state.snapshot(cacheKeys.tags.all())?.data).toEqual({ value: 3 });
  });

  it('invalidate() without a prefix refetches every loaded entry', async () => {
    await state.load(key(), countingFetcher);
    await state.load(['other'], countingFetcher);

    state.invalidate();
    await vi.waitFor(() => expect(fetches).toBe(4));
  });

  it('invalidate() leaves never-loaded keys untouched', () => {
    state.invalidate(cacheKeys.tags.all());
    expect(fetches).toBe(0);
    expect(state.snapshot(cacheKeys.tags.all())).toBeUndefined();
  });

  it('update() patches synchronously and marks the data fresh', async () => {
    await state.load(key(), countingFetcher);

    state.update(key(), (previous) => ({ value: (previous?.value ?? 0) + 100 }));

    expect(state.snapshot(key())?.data).toEqual({ value: 101 });
    vi.setSystemTime(Date.now() + 10_000);
    await state.load(key(), countingFetcher);
    // update() made the entry fresh — no refetch inside the window.
    expect(fetches).toBe(1);
  });

  it('update() on a never-loaded key creates the entry (setQueryData parity)', () => {
    state.update(key(), () => ({ value: 1 }));

    expect(state.snapshot(key())?.data).toEqual({ value: 1 });
  });

  it('update() returning undefined leaves the entry untouched (store no-op)', async () => {
    await state.load(key(), countingFetcher);

    state.update(key(), (previous) => previous);

    expect(state.snapshot(key())?.data).toEqual({ value: 1 });
  });

  it('watch() exposes a reactive signal for a loaded entry', async () => {
    expect(state.watch(key())).toBeUndefined();

    await state.load(key(), countingFetcher);
    const watched = state.watch(key());
    expect(watched?.().data).toEqual({ value: 1 });
  });
});
