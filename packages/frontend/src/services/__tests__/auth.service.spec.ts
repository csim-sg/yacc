/**
 * Unit tests for the auth service endpoint map (MIG-034): every call rides
 * the frozen Spring auth contract (`.docs/migration/openapi.yaml` §auth)
 * and persists the returned token pair.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTokens, getToken, getTokenKind, setTokens } from '../../lib/apiClient';
import { authService } from '../auth.service';

const SESSION_RESPONSE = {
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@yacc.local',
    name: 'System Administrator',
    role: 'super_admin',
    status: 'active',
    emailVerified: true,
    createdAt: '2026-09-27T08:00:00',
    updatedAt: '2026-09-27T08:00:00',
  },
  accessToken: 'access-jwt',
  refreshToken: 'refresh-grant',
  mustChangePassword: true,
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('authService (Spring auth contract)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('signs in against POST /api/auth/sign-in/email and stores the local grant', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, SESSION_RESPONSE));
    vi.stubGlobal('fetch', fetchMock);

    const session = await authService.signIn({ email: 'admin@yacc.local', password: 'secret' });

    expect(session.user.role).toBe('super_admin');
    expect(session.mustChangePassword).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/sign-in/email');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'admin@yacc.local', password: 'secret' });
    expect(getToken()).toBe('access-jwt');
    expect(getTokenKind()).toBe('local');
  });

  it('registers against POST /api/auth/sign-up/email without storing tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, SESSION_RESPONSE));
    vi.stubGlobal('fetch', fetchMock);

    await authService.signUp({ email: 'u@yacc.local', password: 'secret123', name: 'User' });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/sign-up/email');
    expect(getToken()).toBeNull();
  });

  it('reads the session from GET /api/auth/get-session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { user: SESSION_RESPONSE.user, mustChangePassword: true })
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await authService.getSession();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/get-session');
    expect(session?.user.email).toBe('admin@yacc.local');
    expect(session?.mustChangePassword).toBe(true);
  });

  it('signs out against POST /api/auth/sign-out and always clears local state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'expired' }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('yacc_token', 'stale');

    await expect(authService.signOut()).rejects.toBeDefined();

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/sign-out');
    expect(getToken()).toBeNull();
  });

  it('revokes the AS grant at /oauth2/revoke when signing out an oidc session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }));
    vi.stubGlobal('fetch', fetchMock);
    setTokens('as-access', 'as-refresh', 'oidc');

    await authService.signOut();

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls).toEqual(['/api/auth/sign-out', '/oauth2/revoke']);
    const [revokeUrl, revokeInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(revokeUrl).toBe('/oauth2/revoke');
    const revokeBody = String(revokeInit.body);
    expect(revokeBody).toContain('token=as-refresh');
    expect(revokeBody).toContain('client_id=yacc-frontend');
    // Revocation is not a substitute for local cleanup: both happen.
    expect(getToken()).toBeNull();
    expect(getTokenKind()).toBeNull();
  });

  it('signs out a local session without touching /oauth2/revoke', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }));
    vi.stubGlobal('fetch', fetchMock);
    setTokens('local-access', 'local-refresh', 'local');

    await authService.signOut();

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls).toEqual(['/api/auth/sign-out']);
    expect(getToken()).toBeNull();
  });

  it('still revokes the AS grant and clears local state when sign-out fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'expired' }));
    vi.stubGlobal('fetch', fetchMock);
    setTokens('as-access', 'as-refresh', 'oidc');

    await expect(authService.signOut()).rejects.toBeDefined();

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls).toEqual(['/api/auth/sign-out', '/oauth2/revoke']);
    expect(getToken()).toBeNull();
  });

  it('maps change-password, forgot/reset-password and verify-email to the contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { success: true }));
    vi.stubGlobal('fetch', fetchMock);

    await authService.changePassword({ currentPassword: 'old', newPassword: 'new-secret-1' });
    await authService.forgotPassword({ email: 'u@yacc.local' });
    await authService.resetPassword({ token: 'a'.repeat(64), password: 'new-secret-1' });
    await authService.verifyEmail({ token: 'b'.repeat(64) });

    const urls = fetchMock.mock.calls.map((call) => call[0]);
    expect(urls).toEqual([
      '/api/auth/change-password',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/verify-email',
    ]);
    expect(clearTokens).toBeDefined();
  });
});
