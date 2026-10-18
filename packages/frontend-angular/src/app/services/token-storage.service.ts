import { Injectable } from '@angular/core';

/**
 * Which backend grant the stored token pair belongs to (U6 resolution,
 * recorded on issue #374): `local` = the frozen email/password grant
 (`POST /api/auth/sign-in/email`), `oidc` = the embedded-AS
 authorization-code grant adopted at `/auth/callback`.
 */
export type TokenKind = 'local' | 'oidc';

/**
 * The single client-side token store (U6 resolution; ADR-025 bearer
 * model). Holds the bearer access + rotating refresh pair with its grant
 * kind under the SAME storage keys as the merged React-on-Java client
 * (`yacc_token` / `yacc_refresh_token` / `yacc_token_kind`) — the Tier-0
 * auth spec (`packages/frontend/tests/frontend-login.spec.ts`) asserts
 * those keys, making them parity-required.
 *
 * Seam ownership: this service is the ONLY token persistence point. The
 * ANG-005 interceptor chain (auth header, 401-refresh, clear-on-failure)
 * and the ANG-006 socket handshake consume it — token storage must never
 * be duplicated elsewhere. Same sensitivity class as the React client
 * (client-side storage of backend-issued tokens; no new secrets).
 *
 * There is deliberately NO `set-auth-token` capture mechanism and no
 * cookie-session fallback: both are Node/BetterAuth-era behavior,
 * superseded for auth by ADR-025 + the frozen OpenAPI surface
 * (SPEC-003 §Auth Target Correction).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private static readonly ACCESS_TOKEN_KEY = 'yacc_token';
  private static readonly REFRESH_TOKEN_KEY = 'yacc_refresh_token';
  private static readonly TOKEN_KIND_KEY = 'yacc_token_kind';

  /** Stored access token (bearer credential), or null. */
  getAccessToken(): string | null {
    return localStorage.getItem(TokenStorageService.ACCESS_TOKEN_KEY);
  }

  /** Stored rotating refresh grant, or null. */
  getRefreshToken(): string | null {
    return localStorage.getItem(TokenStorageService.REFRESH_TOKEN_KEY);
  }

  /** Stored grant kind, or null (anything but `local`/`oidc` reads null). */
  getTokenKind(): TokenKind | null {
    const kind = localStorage.getItem(TokenStorageService.TOKEN_KIND_KEY);
    return kind === 'local' || kind === 'oidc' ? kind : null;
  }

  /** Store a token pair (access + rotating refresh) with its grant kind. */
  setTokens(accessToken: string, refreshToken: string, kind: TokenKind): void {
    localStorage.setItem(TokenStorageService.ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(TokenStorageService.REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(TokenStorageService.TOKEN_KIND_KEY, kind);
  }

  /**
   * Clear ALL local auth state: the stored token pair plus the legacy POC
   * keys (BetterAuth-era `auth_token` localStorage/cookie and `session`
   * cookie — React `clearTokens` parity). Forced re-login at cutover is
   * inherent — no POC identity continuity survives.
   */
  clear(): void {
    localStorage.removeItem(TokenStorageService.ACCESS_TOKEN_KEY);
    localStorage.removeItem(TokenStorageService.REFRESH_TOKEN_KEY);
    localStorage.removeItem(TokenStorageService.TOKEN_KIND_KEY);
    localStorage.removeItem('auth_token');
    for (const name of ['auth_token', 'session']) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  }
}
