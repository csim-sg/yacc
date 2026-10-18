import { HttpContext, HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { HTTP_IS_MUTATION, HTTP_RETRY_BACKOFF_MS } from './http-context';
import { retryInterceptor } from './retry.interceptor';
import { flushTasks } from '../../testing/flush-tasks';

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

  it('retries a 5xx up to 3 times, then succeeds', async () => {
    const pending = firstValueFrom(
      httpClient.get('/api/conversations', { context: noBackoffContext() }),
    );

    const first = http.expectOne('/api/conversations');
    first.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    await flushTasks();
    const second = http.expectOne('/api/conversations');
    second.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    await flushTasks();
    const third = http.expectOne('/api/conversations');
    third.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    await flushTasks();
    const fourth = http.expectOne('/api/conversations');
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
    await flushTasks();
    const second = http.expectOne('/api/conversations/c1/messages');
    second.flush({ error: 'still down' }, { status: 500, statusText: 'Server Error' });

    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    await pending.catch(() => undefined);
    http.verify(); // 1 + 1 requests only
  });

  it('never retries a 4xx', async () => {
    const pending = firstValueFrom(
      httpClient.get('/api/conversations', { context: noBackoffContext() }),
    );

    const request = http.expectOne('/api/conversations');
    request.flush({ error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
    await pending.catch(() => undefined);
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
      await flushTasks();

      await expect(pending).rejects.toBeInstanceOf(HttpErrorResponse);
      await pending.catch(() => undefined);
      http.verify(); // single attempt — offline means no retry
    } finally {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
    }
  });
});
