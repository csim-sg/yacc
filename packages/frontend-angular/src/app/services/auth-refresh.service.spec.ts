import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { environment } from '../../environments/environment';
import { AuthRefreshService } from './auth-refresh.service';
import { TokenStorageService } from './token-storage.service';

/**
 * AuthRefreshService spec (the single 401-refresh seam, React
 * `attemptTokenRefresh` port): one refresh path per grant kind,
 * single-flight, rotation persisted via `TokenStorageService`, forced
 * re-login helper.
 */
describe('AuthRefreshService', () => {
  let service: AuthRefreshService;
  let tokens: TokenStorageService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    service = TestBed.inject(AuthRefreshService);
    tokens = TestBed.inject(TokenStorageService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  it('refreshes the local grant and persists the rotated pair', async () => {
    tokens.setTokens('access-old', 'refresh-1', 'local');

    const pending = service.refresh();
    const request = http.expectOne('/api/auth/refresh-token');
    expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
    request.flush({ accessToken: 'access-new', refreshToken: 'refresh-2' });

    await expect(pending).resolves.toBe(true);
    expect(tokens.getAccessToken()).toBe('access-new');
    expect(tokens.getRefreshToken()).toBe('refresh-2');
    expect(tokens.getTokenKind()).toBe('local');
  });

  it('refreshes the oidc grant against the embedded AS token endpoint', async () => {
    tokens.setTokens('access-old', 'refresh-1', 'oidc');

    const pending = service.refresh();
    const request = http.expectOne(`${environment.oidcIssuer}/oauth2/token`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toContain('grant_type=refresh_token');
    expect(request.request.body).toContain('refresh_token=refresh-1');
    expect(request.request.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
    request.flush({ access_token: 'as-access', refresh_token: 'as-refresh' });

    await expect(pending).resolves.toBe(true);
    expect(tokens.getAccessToken()).toBe('as-access');
    expect(tokens.getRefreshToken()).toBe('as-refresh');
    expect(tokens.getTokenKind()).toBe('oidc');
  });

  it('single-flights concurrent refreshes into one HTTP call', async () => {
    tokens.setTokens('access-old', 'refresh-1', 'local');

    const first = service.refresh();
    const second = service.refresh();
    const request = http.expectOne('/api/auth/refresh-token');
    request.flush({ accessToken: 'access-new', refreshToken: 'refresh-2' });

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    http.verify(); // exactly one refresh call
  });

  it('answers false without any HTTP call when no refresh token exists', async () => {
    await expect(service.refresh()).resolves.toBe(false);
    http.expectNone('/api/auth/refresh-token');
  });

  it('answers false when the refresh call fails and keeps the session decision to the caller', async () => {
    tokens.setTokens('access-old', 'refresh-1', 'local');

    const pending = service.refresh();
    const request = http.expectOne('/api/auth/refresh-token');
    request.flush({ error: 'invalid grant' }, { status: 401, statusText: 'Unauthorized' });

    await expect(pending).resolves.toBe(false);
  });

  it('answers false when the oidc AS response lacks the rotated pair', async () => {
    tokens.setTokens('access-old', 'refresh-1', 'oidc');

    const pending = service.refresh();
    const request = http.expectOne(`${environment.oidcIssuer}/oauth2/token`);
    request.flush({ access_token: 'only-access' });

    await expect(pending).resolves.toBe(false);
  });

  it('forceReLogin clears every auth trace and navigates to /login in-SPA', () => {
    tokens.setTokens('access-old', 'refresh-1', 'local');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    service.forceReLogin();

    expect(tokens.getAccessToken()).toBeNull();
    expect(tokens.getRefreshToken()).toBeNull();
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/login']);
  });
});
