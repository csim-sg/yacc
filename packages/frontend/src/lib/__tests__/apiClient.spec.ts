/**
 * Unit tests for the single API client auth behavior (MIG-034):
 * token-pair storage, local/oidc grant refresh rotation, forced re-login
 * on unrecoverable sessions, and query-parameter building.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  api,
  clearTokens,
  getRefreshToken,
  getToken,
  getTokenKind,
  setTokens,
} from '../apiClient';

const ACCESS = 'access-jwt';
const REFRESH = 'refresh-grant';
const NEW_ACCESS = 'access-jwt-2';
const NEW_REFRESH = 'refresh-grant-2';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('apiClient token store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores and clears the full token pair with its grant kind', () => {
    setTokens(ACCESS, REFRESH, 'local');
    expect(getToken()).toBe(ACCESS);
    expect(getRefreshToken()).toBe(REFRESH);
    expect(getTokenKind()).toBe('local');

    clearTokens();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getTokenKind()).toBeNull();
  });

  it('clears legacy POC auth state (no POC identity continuity)', () => {
    localStorage.setItem('auth_token', 'poc-leftover');
    setTokens(ACCESS, REFRESH, 'local');

    clearTokens();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('yacc_token')).toBeNull();
    expect(document.cookie).not.toContain('auth_token=');
  });
});

describe('apiClient transport', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('appends query params and sends the Bearer access token', async () => {
    setTokens(ACCESS, REFRESH, 'local');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/api/conversations', { params: { page: 2, tag: ['a', 'b'], empty: undefined } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/conversations?page=2&tag=a&tag=b');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${ACCESS}`);
  });

  it('refreshes the local grant on 401 and replays the request', async () => {
    setTokens(ACCESS, REFRESH, 'local');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'expired' }))
      // refresh-token call
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: NEW_ACCESS, refreshToken: NEW_REFRESH }))
      // replay
      .mockResolvedValueOnce(jsonResponse(200, { done: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.get<{ done: boolean }>('/api/conversations');

    expect(result).toEqual({ done: true });
    expect(getToken()).toBe(NEW_ACCESS);
    expect(getRefreshToken()).toBe(NEW_REFRESH);
    const refreshCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(refreshCall[0]).toBe('/api/auth/refresh-token');
    expect(JSON.parse(String(refreshCall[1].body))).toEqual({ refreshToken: REFRESH });
  });

  it('refreshes the oidc grant against the embedded AS token endpoint', async () => {
    setTokens(ACCESS, REFRESH, 'oidc');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'expired' }))
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: NEW_ACCESS, refresh_token: NEW_REFRESH })
      )
      .mockResolvedValueOnce(jsonResponse(200, { done: true }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/api/conversations');

    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(refreshUrl).toBe('/oauth2/token');
    expect(refreshInit.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(String(refreshInit.body)).toContain('grant_type=refresh_token');
    expect(getToken()).toBe(NEW_ACCESS);
    expect(getTokenKind()).toBe('oidc');
  });

  it('forces re-login (clears all auth state) when the refresh grant is unrecoverable', async () => {
    setTokens(ACCESS, REFRESH, 'local');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(401, { error: 'invalid_grant' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/api/conversations')).rejects.toBeInstanceOf(ApiError);

    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getTokenKind()).toBeNull();
  });

  it('surfaces the frozen {error} body as an ApiError with the status code', async () => {
    setTokens(ACCESS, REFRESH, 'local');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(403, { error: 'Not super_admin' }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await api.get('/api/users').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).statusCode).toBe(403);
    expect((error as ApiError).message).toBe('Not super_admin');
  });
});
