import { HttpContext, HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../contracts/common/api-error';
import { HTTP_BYPASS_AUTH, HTTP_TIMEOUT_MS } from './http-context';
import { timeoutInterceptor } from './timeout.interceptor';
import { errorMappingInterceptor } from './error-mapping.interceptor';

/**
 * Timeout interceptor spec (T2 §3.5): a request exceeding its per-attempt
 * timeout fails fast; `HTTP_BYPASS_AUTH` requests are never wrapped. A
 * short real timeout is armed and we wait LONGER than it — waiting for a
 * deterministic timer, not racing a sleep.
 */
describe('timeoutInterceptor', () => {
  let httpClient: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorMappingInterceptor, timeoutInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fails a request that exceeds the per-attempt timeout', async () => {
    const context = new HttpContext().set(HTTP_TIMEOUT_MS, 5).set(HTTP_BYPASS_AUTH, false);
    const pending = firstValueFrom(httpClient.get('/api/conversations', { context }));

    http.expectOne('/api/conversations'); // the request is issued, never flushed
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect(pending).rejects.toBeInstanceOf(ApiError);
    await pending.catch((error: ApiError) => {
      expect(error.statusCode).toBe(0);
      expect(error.message).toBe('Request timeout');
    });
  });

  it('does not time out a request answered inside the window', async () => {
    const context = new HttpContext().set(HTTP_TIMEOUT_MS, 5000);
    const pending = firstValueFrom(httpClient.get('/api/conversations', { context }));

    const request = http.expectOne('/api/conversations');
    request.flush({ ok: true });

    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('skips the timeout for HTTP_BYPASS_AUTH requests (bare refresh calls)', async () => {
    const context = new HttpContext().set(HTTP_TIMEOUT_MS, 5).set(HTTP_BYPASS_AUTH, true);
    const pending = firstValueFrom(httpClient.get('/api/auth/refresh-token', { context }));

    const request = http.expectOne('/api/auth/refresh-token');
    // Long past the 5ms mark the bare request is still live (no wrap)…
    await new Promise((resolve) => setTimeout(resolve, 25));
    request.flush({});

    await expect(pending).resolves.toEqual({});
  });
});
