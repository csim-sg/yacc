import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

/**
 * AuthService spec (ANG-004).
 *
 * Session restore at init, sign-in (local grant + forced-change state),
 * sign-out (unconditional local clear; AS-grant revocation for oidc
 * sessions), registration without auto-login, role normalization at the
 * auth boundary (unknown → USER), and the recovery/change-password
 * endpoint wiring against the frozen `/api/auth/*` surface.
 */
describe('AuthService', () => {
  /** Canonical wire user (frozen openapi.yaml `UserResponse`). */
  function wireUser(role: string): Record<string, unknown> {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@yacc.local',
      name: 'System Administrator',
      role,
      status: 'active',
      emailVerified: true,
      createdAt: '2026-09-27T08:00:00',
      updatedAt: '2026-09-27T08:00:00',
    };
  }

  function session(overrides: { role?: string; mustChangePassword?: boolean } = {}): Record<string, unknown> {
    return {
      user: wireUser(overrides.role ?? 'super_admin'),
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      mustChangePassword: overrides.mustChangePassword ?? false,
    };
  }

  let service: AuthService;
  let tokens: TokenStorageService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'auth_token=; Max-Age=0; path=/';
    document.cookie = 'session=; Max-Age=0; path=/';
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    tokens = TestBed.inject(TokenStorageService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('session restore (loadSession at app init)', () => {
    it('settles the app-init load without an HTTP call when no token is stored', async () => {
      // The constructor fired the one-time init load (AuthProvider mount
      // parity); tokenless state settles immediately, no identity asserted.
      expect(service.user()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.isLoading()).toBe(false);
      http.expectNone('/api/auth/get-session');
    });

    it('restores the user from the stored token (get-session with Bearer)', async () => {
      tokens.setTokens('access-1', 'refresh-1', 'local');
      const pending = service.loadSession();
      const request = http.expectOne('/api/auth/get-session');
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
      request.flush({ user: wireUser('manager'), mustChangePassword: true });
      await pending;

      expect(service.user()?.role).toBe('MANAGER');
      expect(service.mustChangePassword()).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('clears the local auth state when the token is rejected (401)', async () => {
      tokens.setTokens('access-stale', 'refresh-stale', 'local');
      const pending = service.loadSession();
      http
        .expectOne('/api/auth/get-session')
        .flush({ error: 'Missing or invalid token' }, { status: 401, statusText: 'Unauthorized' });
      await pending;

      expect(tokens.getAccessToken()).toBeNull();
      expect(service.user()).toBeNull();
      expect(service.mustChangePassword()).toBe(false);
    });

    it('clears the local auth state on any transport failure (no identity continuity)', async () => {
      tokens.setTokens('access-1', 'refresh-1', 'local');
      const pending = service.loadSession();
      http.expectOne('/api/auth/get-session').error(new ProgressEvent('network error'));
      await pending;

      expect(tokens.getAccessToken()).toBeNull();
      expect(service.user()).toBeNull();
    });

    it('memoizes the init load — later callers share the settled promise (no second lookup)', async () => {
      // The constructor already ran the one-time init load.
      const first = service.ensureSessionLoaded();
      const second = service.ensureSessionLoaded();
      expect(first).toBe(second);

      await Promise.all([first, second]);
      http.expectNone('/api/auth/get-session');
    });
  });

  describe('sign-in (local grant, W1)', () => {
    it('stores the token pair as kind `local` and resolves the forced-change flag', async () => {
      const pending = service.signIn({ email: 'admin@yacc.local', password: 'admin123' });
      http.expectOne('/api/auth/sign-in/email').flush(session());
      const mustChange = await pending;

      expect(mustChange).toBe(false);
      expect(tokens.getAccessToken()).toBe('access-1');
      expect(tokens.getRefreshToken()).toBe('refresh-1');
      expect(tokens.getTokenKind()).toBe('local');
      expect(service.user()?.role).toBe('SUPER_ADMIN');
      expect(service.mustChangePassword()).toBe(false);
    });

    it('surfaces the ADR-025 forced-credential-change state for bootstrap identities', async () => {
      const pending = service.signIn({ email: 'admin@yacc.local', password: 'one-time-credential' });
      http.expectOne('/api/auth/sign-in/email').flush(session({ mustChangePassword: true }));
      const mustChange = await pending;

      expect(mustChange).toBe(true);
      expect(service.mustChangePassword()).toBe(true);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('normalizes an unknown wire role to USER exactly at the auth boundary', async () => {
      const pending = service.signIn({ email: 'x@yacc.local', password: 'pw' });
      http.expectOne('/api/auth/sign-in/email').flush(session({ role: 'some_future_role' }));
      await pending;

      expect(service.user()?.role).toBe('USER');
    });

    it('surfaces the frozen error body and stores nothing on invalid credentials', async () => {
      const pending = service.signIn({ email: 'admin@yacc.local', password: 'wrong' });
      const assertion = expect(pending).rejects.toThrow();
      http
        .expectOne('/api/auth/sign-in/email')
        .flush({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
      await assertion;

      expect(service.error()).toBe('Invalid credentials');
      expect(tokens.getAccessToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.isLoading()).toBe(false);
    });

    it('clears a previous error on the next attempt', async () => {
      const failing = service.signIn({ email: 'a@b.c', password: 'pw' });
      const rejection = expect(failing).rejects.toThrow();
      http
        .expectOne('/api/auth/sign-in/email')
        .flush({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
      await rejection;
      expect(service.error()).toBe('Invalid credentials');

      const retrying = service.signIn({ email: 'a@b.c', password: 'pw' });
      http.expectOne('/api/auth/sign-in/email').flush(session());
      await retrying;
      expect(service.error()).toBeNull();
    });
  });

  describe('sign-out (W2)', () => {
    it('clears ALL local auth state even when the endpoint fails', async () => {
      tokens.setTokens('access-1', 'refresh-1', 'local');
      const pending = service.signIn({ email: 'a@b.c', password: 'pw' });
      http.expectOne('/api/auth/sign-in/email').flush(session());
      await pending;

      const signOut = expect(service.signOut()).rejects.toThrow();
      http
        .expectOne((request) => request.url === '/api/auth/sign-out')
        .flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
      await signOut;

      expect(tokens.getAccessToken()).toBeNull();
      expect(tokens.getRefreshToken()).toBeNull();
      expect(service.user()).toBeNull();
      expect(service.mustChangePassword()).toBe(false);
    });

    it('sends the Bearer header and clears state on success (local grant, no AS revoke)', async () => {
      tokens.setTokens('access-1', 'refresh-1', 'local');
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const pending = service.signOut();
      const request = http.expectOne((candidate) => candidate.url === '/api/auth/sign-out');
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
      request.flush({ success: true });
      await pending;

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(tokens.getAccessToken()).toBeNull();
      expect(service.user()).toBeNull();
      vi.unstubAllGlobals();
    });

    it('revokes the AS grant for an oidc session before clearing (MIG-033)', async () => {
      tokens.setTokens('as-access', 'as-refresh', 'oidc');
      const revokeBodies: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
          revokeBodies.push(String(init?.body ?? ''));
          return new Response('{}', { status: 200 });
        })
      );

      const pending = service.signOut();
      http.expectOne('/api/auth/sign-out').flush({ success: true });
      await pending;

      expect(revokeBodies).toHaveLength(1);
      expect(revokeBodies[0]).toContain('token=as-refresh');
      expect(revokeBodies[0]).toContain('client_id=yacc-frontend');
      expect(tokens.getAccessToken()).toBeNull();
      expect(tokens.getRefreshToken()).toBeNull();
      vi.unstubAllGlobals();
    });
  });

  describe('registration (W3)', () => {
    it('registers without auto-login — no token is stored', async () => {
      const pending = service.register({ email: 'new@yacc.local', password: 'secret1', name: 'New User' });
      http.expectOne('/api/auth/sign-up/email').flush(session({ role: 'user' }));
      await pending;

      expect(tokens.getAccessToken()).toBeNull();
      expect(tokens.getRefreshToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('surfaces registration errors (frozen error body)', async () => {
      const pending = service.register({ email: 'taken@yacc.local', password: 'secret1', name: 'Dup' });
      const assertion = expect(pending).rejects.toThrow();
      http
        .expectOne('/api/auth/sign-up/email')
        .flush({ error: 'Validation error' }, { status: 400, statusText: 'Bad Request' });
      await assertion;

      expect(service.error()).toBe('Validation error');
    });
  });

  describe('recovery and credential change (W4 / ADR-025)', () => {
    it('requests a password reset (constant anti-enumeration answer)', async () => {
      const pending = service.forgotPassword({ email: 'user@yacc.local' });
      http.expectOne('/api/auth/forgot-password').flush({ message: 'Reset link sent if account exists' });
      await expect(pending).resolves.toBeDefined();
    });

    it('resets the password with the emailed token', async () => {
      const pending = service.resetPassword({ token: 'the-token', password: 'new-secret-1' });
      http.expectOne('/api/auth/reset-password').flush({ success: true, message: 'Password reset' });
      await expect(pending).resolves.toBeDefined();
    });

    it('replaces the credential with the Bearer header (forced-change clear path)', async () => {
      tokens.setTokens('access-1', 'refresh-1', 'local');
      const pending = service.changePassword({ currentPassword: 'one-time', newPassword: 'permanent-1' });
      const request = http.expectOne('/api/auth/change-password');
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
      expect(request.request.body).toEqual({ currentPassword: 'one-time', newPassword: 'permanent-1' });
      request.flush({ success: true });
      await expect(pending).resolves.toBeDefined();
    });

    it('marks the forced-change state cleared after a successful change', () => {
      service.markPasswordChanged();
      expect(service.mustChangePassword()).toBe(false);
    });
  });
});
