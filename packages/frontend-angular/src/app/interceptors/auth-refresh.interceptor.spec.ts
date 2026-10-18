import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../contracts/common/api-error';
import { TokenStorageService } from '../services/token-storage.service';
import { authHeaderInterceptor } from './auth-header.interceptor';
import { authRefreshInterceptor } from './auth-refresh.interceptor';
import { errorMappingInterceptor } from './error-mapping.interceptor';

/**
 * 401-refresh interceptor spec (AC-ANG-005-3; T2 §3.1/§3.5): single-flight
 * refresh (concurrent 401s → exactly one refresh call), replay EXACTLY
 * ONCE with the rotated bearer, clear + in-SPA `/login` on failure, and
 * the public-auth-surface exception (a 401 on `/api/auth/*` is a surfaced
 * error, never a session loss). The chain mirrors the registered order
 * (error-mapping → auth-header → auth-refresh) minus the uninvolved
 * retry/timeout/correlation stages.
 */
describe('authRefreshInterceptor', () => {
  let httpClient: HttpClient;
  let http: HttpTestingController;
  let tokens: TokenStorageService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([errorMappingInterceptor, authHeaderInterceptor, authRefreshInterceptor]),
        ),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStorageService);
    router = TestBed.inject(Router);
    tokens.setTokens('stale-access', 'refresh-1', 'local');
  });

  afterEach(() => http.verify());

  it('refreshes once, then replays the request with the rotated bearer', async () => {
    const pending = firstValueFrom(httpClient.get<unknown>('/api/conversations'));

    const original = http.expectOne('/api/conversations');
    expect(original.request.headers.get('Authorization')).toBe('Bearer stale-access');
    original.flush({ error: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = http.expectOne('/api/auth/refresh-token');
    expect(refresh.request.method).toBe('POST');
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    refresh.flush({ accessToken: 'new-access', refreshToken: 'refresh-2' });

    const replays: TestRequest[] = [];
    await vi.waitFor(() => {
      replays.push(...http.match('/api/conversations'));
      expect(replays).toHaveLength(1);
    });
    expect(replays[0].request.headers.get('Authorization')).toBe('Bearer new-access');
    replays[0].flush({ data: [] });

    await expect(pending).resolves.toEqual({ data: [] });
    expect(tokens.getAccessToken()).toBe('new-access');
    expect(tokens.getRefreshToken()).toBe('refresh-2');
  });

  it('single-flights concurrent 401s into ONE refresh and replays all requests', async () => {
    const first = firstValueFrom(httpClient.get<unknown>('/api/conversations'));
    const second = firstValueFrom(httpClient.get<unknown>('/api/users'));

    for (const url of ['/api/conversations', '/api/users']) {
      const request = http.expectOne(url);
      request.flush({ error: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    }

    // Exactly one refresh call for both concurrent 401s.
    const refresh = http.expectOne('/api/auth/refresh-token');
    refresh.flush({ accessToken: 'new-access', refreshToken: 'refresh-2' });

    const replays: TestRequest[] = [];
    await vi.waitFor(() => {
      replays.push(...http.match((req) => true));
      expect(replays).toHaveLength(2);
    });
    for (const replay of replays) {
      expect(replay.request.headers.get('Authorization')).toBe('Bearer new-access');
      replay.flush({});
    }

    await expect(Promise.all([first, second])).resolves.toEqual([{}, {}]);
    http.verify();
  });

  it('clears tokens and navigates to /login when the refresh fails', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const pending = firstValueFrom(httpClient.get<unknown>('/api/conversations'));

    const original = http.expectOne('/api/conversations');
    original.flush({ error: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = http.expectOne('/api/auth/refresh-token');
    refresh.flush({ error: 'invalid grant' }, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toBeInstanceOf(ApiError);
    await pending.catch((error: ApiError) => {
      expect(error.statusCode).toBe(401);
    });
    expect(tokens.getAccessToken()).toBeNull();
    expect(tokens.getRefreshToken()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/login']);
  });

  it('does not refresh twice: a second 401 on the replay forces re-login', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const pending = firstValueFrom(httpClient.get<unknown>('/api/conversations'));

    const original = http.expectOne('/api/conversations');
    original.flush({ error: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = http.expectOne('/api/auth/refresh-token');
    refresh.flush({ accessToken: 'new-access', refreshToken: 'refresh-2' });

    const replays: TestRequest[] = [];
    await vi.waitFor(() => {
      replays.push(...http.match('/api/conversations'));
      expect(replays).toHaveLength(1);
    });
    // Even a fresh token can be rejected (revoked server-side): no second refresh.
    replays[0].flush({ error: 'revoked' }, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toBeInstanceOf(ApiError);
    expect(tokens.getAccessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/login']);
    http.verify(); // no third request was attempted
  });

  it('surfaces a 401 from the public auth surface without refresh or redirect', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const pending = firstValueFrom(
      httpClient.post<unknown>('/api/auth/sign-in/email', { email: 'a@b.c', password: 'nope' }),
    );

    const request = http.expectOne('/api/auth/sign-in/email');
    request.flush({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toBeInstanceOf(ApiError);
    await pending.catch((error: ApiError) => {
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Invalid credentials');
    });
    // The stored session is untouched; no refresh call, no navigation.
    expect(tokens.getAccessToken()).toBe('stale-access');
    expect(navigate).not.toHaveBeenCalled();
    http.verify();
  });

  it('forces re-login on a 401 when no refresh token exists', async () => {
    tokens.clear();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const pending = firstValueFrom(httpClient.get<unknown>('/api/conversations'));

    const request = http.expectOne('/api/conversations');
    request.flush({ error: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).rejects.toBeInstanceOf(ApiError);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/login']);
    http.verify();
  });
});
