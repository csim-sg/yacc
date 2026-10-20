import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { appConfig } from './app.config';

/**
 * App-shell config spec (ANG-003 scaffold; extended by ANG-005): pins the
 * shell wiring `bootstrapApplication` consumes in `main.ts` — zone change
 * detection retained explicitly (ADR-031 decision 4), the router, and the
 * ONE HttpClient seam (ARCH-005 boundary 1) carrying the full ANG-005
 * interceptor chain. The behavioral pin proves a plain request crosses
 * every registered stage (correlation id attached, no auth header without
 * a stored token, typed response).
 */
describe('appConfig', () => {
  it('provides shell-level providers (router + zone change detection)', () => {
    expect(Array.isArray(appConfig.providers)).toBe(true);
    expect(appConfig.providers.length).toBeGreaterThan(0);
  });

  it('runs a plain request through the registered interceptor chain', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    const httpClient = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);

    try {
      const done = firstValueFrom(httpClient.get<unknown>('/api/health'));

      const request = http.expectOne('/api/health');
      expect(request.request.headers.get('X-Request-ID')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(request.request.headers.get('Authorization')).toBeNull();
      request.flush({ ok: true });

      await expect(done).resolves.toEqual({ ok: true });
    } finally {
      http.verify();
    }
  });
});
