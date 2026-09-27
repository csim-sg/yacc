/// <reference types="vite/client" />

/**
 * The single YACC API client (MIG-034; SPEC-002 AC-07).
 *
 * One transport, one token store, one refresh path per grant kind:
 * - local grant  — MIG-030 frozen contract: POST /api/auth/refresh-token
 *                  `{refreshToken}` → `{accessToken, refreshToken}` rotation.
 * - oidc grant   — MIG-033 embedded AS: POST {issuer}/oauth2/token
 *                  `grant_type=refresh_token` (public client, rotation).
 *
 * On a failed refresh every local auth state is cleared (including legacy
 * POC keys — no POC identity continuity) and the browser is forced back to
 * /login (forced re-login, SPEC-002 §Security).
 *
 * Responsibilities (SoC): transport + token persistence + auth retry only.
 * Auth endpoint calls live in `services/auth.service.ts`; the OIDC browser
 * dance lives in `services/oidc.service.ts`.
 */

import type { AuthRefreshResponse } from '../types/auth.types';

/** Which backend grant the stored token pair belongs to. */
export type TokenKind = 'local' | 'oidc';

/** API base URL from environment (Vite). Empty = same-origin (default). */
function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
}

const API_BASE_URL = getApiBaseUrl();

/** Storage keys. `yacc_token` keeps its historical name (access token). */
const ACCESS_TOKEN_KEY = 'yacc_token';
const REFRESH_TOKEN_KEY = 'yacc_refresh_token';
const TOKEN_KIND_KEY = 'yacc_token_kind';

/**
 * Typed API error carrying the HTTP status code (resolved from the two
 * duplicated clients this module replaces).
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Frozen error body shape (`ErrorResponse`: `{ error: string }`). */
interface ErrorBody {
  error?: string;
}

/** Fetch options with timeout, retry and query-parameter configuration. */
interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  params?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Token store (local auth state)
// ---------------------------------------------------------------------------

/** Get the stored access token. */
export function getToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/** Get the stored refresh grant. */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** Get the stored grant kind. */
export function getTokenKind(): TokenKind | null {
  const kind = localStorage.getItem(TOKEN_KIND_KEY);
  return kind === 'local' || kind === 'oidc' ? kind : null;
}

/** Store a token pair (access + rotating refresh) with its grant kind. */
export function setTokens(
  accessToken: string,
  refreshToken: string,
  kind: TokenKind
): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(TOKEN_KIND_KEY, kind);
}

/**
 * Clear ALL local auth state: the stored token pair plus legacy POC keys
 * (BetterAuth-era `auth_token`/`session` material). Forced re-login at
 * cutover is inherent — no POC identity continuity survives.
 */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_KIND_KEY);
  // Legacy POC keys (superseded clients stored credentials here).
  localStorage.removeItem('auth_token');
  for (const name of ['auth_token', 'session']) {
    document.cookie = `${name}=; Max-Age=0; path=/`;
  }
}

// ---------------------------------------------------------------------------
// Refresh (one path per grant kind, single-flight)
// ---------------------------------------------------------------------------

/** Prevents multiple concurrent refresh requests. */
let refreshPromise: Promise<boolean> | null = null;

/** POST {issuer}/oauth2/token — refresh-grant rotation for the AS grant. */
async function refreshOidcGrant(refreshToken: string): Promise<AuthRefreshResponse | null> {
  const issuer = (import.meta.env.VITE_OIDC_ISSUER as string | undefined) || '';
  const clientId = (import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined) || 'yacc-frontend';
  const response = await fetch(`${issuer}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { access_token?: string; refresh_token?: string };
  if (!data.access_token || !data.refresh_token) {
    return null;
  }
  return { accessToken: data.access_token, refreshToken: data.refresh_token };
}

/** POST /api/auth/refresh-token — rotation for the local (MIG-030) grant. */
async function refreshLocalGrant(refreshToken: string): Promise<AuthRefreshResponse | null> {
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AuthRefreshResponse;
}

/**
 * Refresh the stored grant (rotated on use). Single-flight: concurrent
 * callers share one request. Answers false when the session cannot be
 * recovered — the caller must then force re-login.
 */
async function attemptTokenRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  const kind = getTokenKind();
  if (!refreshToken || !kind) {
    return false;
  }

  if (!refreshPromise) {
    refreshPromise = (async (): Promise<boolean> => {
      try {
        const rotated =
          kind === 'oidc'
            ? await refreshOidcGrant(refreshToken)
            : await refreshLocalGrant(refreshToken);
        if (!rotated) {
          return false;
        }
        setTokens(rotated.accessToken, rotated.refreshToken, kind);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

/** Forced re-login: clear every trace of local auth state, then redirect. */
function forceReLogin(): void {
  clearTokens();
  window.location.assign('/login');
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

/** Build `?a=1&b=2` from an options object (undefined/null skipped). */
function buildQueryString(params: Record<string, unknown>): string {
  const entries: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
      }
    } else {
      entries.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return entries.join('&');
}

/** Extract a readable message from the frozen `{error}` body. */
async function toApiError(response: Response): Promise<ApiError> {
  let body: ErrorBody | null = null;
  try {
    body = (await response.json()) as ErrorBody;
  } catch {
    body = null;
  }
  return new ApiError(response.status, body?.error || `HTTP ${response.status}`, body);
}

/** Single fetch with auth header, timeout, refresh-on-401 and 5xx retry. */
async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {},
  responseType: 'json' | 'blob' = 'json'
): Promise<T> {
  const { timeout = 30000, retries = 3, params, ...fetchOptions } = options;

  const url = `${API_BASE_URL}${endpoint}${params ? `?${buildQueryString(params)}` : ''}`;
  const extraHeaders = fetchOptions.headers as Record<string, string> | undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': crypto.randomUUID(),
    ...extraHeaders,
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });

      clearTimeout(timeoutId);

      if (response.ok) {
        if (responseType === 'blob') {
          return await response.blob() as T;
        }
        return await response.json() as T;
      }

      // 401 → try one grant rotation, then replay the request once.
      // The public auth surface answers 401 semantically (invalid
      // credentials, unknown reset token) — a 401 there is an error to
      // surface, never a session loss.
      if (response.status === 401) {
        const isPublicAuthEndpoint = endpoint.startsWith('/api/auth/');
        if (
          !isPublicAuthEndpoint &&
          (await attemptTokenRefresh())
        ) {
          return await apiFetch<T>(endpoint, { ...options, retries: 0 }, responseType);
        }
        if (!isPublicAuthEndpoint) {
          forceReLogin();
        }
        throw await toApiError(response);
      }

      // 5xx → transient, retry with exponential backoff.
      if (response.status >= 500 && attempt < retries) {
        await new Promise<void>((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        attempt++;
        continue;
      }

      throw await toApiError(response);
    } catch (error: unknown) {
      // Timeout → transient, retry with exponential backoff.
      if (error instanceof Error && error.name === 'AbortError' && attempt < retries) {
        await new Promise<void>((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        attempt++;
        continue;
      }
      lastError = error instanceof Error ? error : new Error('Request failed');
      throw lastError;
    }
  }

  throw lastError || new Error('Request failed');
}

/** HTTP methods. */
export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }, 'json'),

  post: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }, 'json'),

  patch: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }, 'json'),

  put: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }, 'json'),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }, 'json'),

  /** Download blob (e.g., file export). */
  blob: <T extends Blob>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }, 'blob'),
};

/** Base URL of the API (exported for the OIDC service token endpoint). */
export function getApiBaseUrlValue(): string {
  return API_BASE_URL;
}
