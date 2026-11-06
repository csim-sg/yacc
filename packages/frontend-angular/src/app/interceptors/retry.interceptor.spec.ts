import { HttpContext, HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';

import { HTTP_IS_MUTATION, HTTP_RETRY_BACKOFF_MS } from './http-context';
import { retryInterceptor } from './retry.interceptor';
import { flushTasks } from '../../testing/flush-tasks';

// Headroom for CI worker starvation: the waits below are fast in the normal
// case (the retry chain settles within a macrotask tick) and only poll toward
// these bounds in the pathological case.
vi.setConfig({ testTimeout: 30_000 });

/**
 * Retry interceptor spec (AC-ANG-005-3; T2 §3.1/§3.5): 3× for queries /
 * 1× for mutations, 5xx and timeout only, never 4xx, never offline.
 * Backoff is provided as 0 so retries are drained on the macrotask queue
 * (no real sleeps, no flake).
 */
describe('retryInterceptor', () => {
  let httpClient: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([retryInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function noBackoffContext(): HttpContext {
    return new HttpContext().set(HTTP_RETRY_BACKOFF_MS, 0);
  }

  /**
   * Wait until exactly one request matching `url` is pending and return it.
   *
   * Angular 21's `HttpTestingController.match()` CONSUMES matched requests
   * (it splices them from the open list), so this polls `match` and hands
   * back the consumed handle for `flush()` — a later `expectOne` would
   * always throw "found none". Retry chains re-issue on a macrotask; a
   * single `flushTasks()` tick is an ordering assumption that breaks under
   * CI worker starvation (zone.js task stalls), hence the poll.
   */
  async function waitForRequest(url: string, timeoutMs = 10_000): Promise<TestRequest> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const matched = http.match(url);
      if (matched.length === 1) return matched[0];
      if (matched.length > 1) {
        throw new Error(`expected exactly one pending request for ${url}, found ${matched.length}`);
      }
      if (Date.now() > deadline) {
        throw new Error(`expected a pending request for ${url} within ${timeoutMs}ms`);
      }
      await flushTasks();
    }
  }

  /**
   * Drain macrotasks until `pending` settles (resolve or reject), then
   * surface the original outcome. Tolerates zone.js task stalls that delay
   * the rxjs retry timer beyond a single tick under CI load.
   */
  async function waitForSettled(pending: Promise<unknown>, timeoutMs = 20_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let settled = false;
    const probe = pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    while (!settled) {
      if (Date.now() > deadline) {
        throw new Error(`expected the request chain to settle within ${timeoutMs}ms`);
      }
      await flushTasks();
    }
    await probe; // surface the original rejection, if any
  }

  it('retries a 5xx up to 3 times, then succeeds', async () => {
    const pending = firstValueFrom(
      httpClient.get('/api/conversations', { context: noBackoffContext() }),
    );

    const first = http.expectOne('/api/conversations');
    first.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    const second = await waitForRequest('/api/conversations');
    second.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    const third = await waitForRequest('/api/conversations');
    third.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    const fourth = await waitForRequest('/api/conversations');
    fourth.flush({ data: [] });

    await expect(pending).resolves.toEqual({ data: [] });
    http.verify(); // exactly 1 + 3 requests, no more
  });

  it('retries a mutation only once (HTTP_IS_MUTATION)', async () => {
    const context = noBackoffContext().set(HTTP_IS_MUTATION, true);
    const pending = firstValueFrom(
      httpClient.post('/api/conversations/c1/messages', { body: 'hi' }, { context }),
    );

    const first = http.expectOne('/api/conversations/c1/messages');
    first.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    const second = await waitForRequest('/api/conversations/c1/messages');
    second.flush({ error: 'still down' }, { status: 500, statusText: 'Server Error' });

    await waitForSettled(pending);
    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    http.verify(); // 1 + 1 requests only
  });

  it('never retries a 4xx', async () => {
    const pending = firstValueFrom(
      httpClient.get('/api/conversations', { context: noBackoffContext() }),
    );

    const request = http.expectOne('/api/conversations');
    request.flush({ error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await waitForSettled(pending);
    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    http.verify();
  });

  it('does not retry while the browser is offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false });
    try {
      const pending = firstValueFrom(
        httpClient.get('/api/conversations', { context: noBackoffContext() }),
      );

      const request = http.expectOne('/api/conversations');
      request.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
      await waitForSettled(pending);

      await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
      http.verify(); // single attempt — offline means no retry
    } finally {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
    }
  });
});
