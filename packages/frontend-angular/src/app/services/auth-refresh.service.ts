import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import type { AuthRefreshResponse, RefreshTokenRequest } from '../contracts/http/auth.schema';
import { HTTP_BYPASS_AUTH, HTTP_RETRIES } from '../interceptors/http-context';
import { TokenStorageService, type TokenKind } from './token-storage.service';

/**
 * Context for the refresh calls themselves: bare (no auth header, no
 * correlation id, no timeout/retry) — reference-client parity — and
 * invisible to the 401 path so a failing refresh can never recurse.
 */
function refreshCallContext(): HttpContext {
  return new HttpContext().set(HTTP_BYPASS_AUTH, true).set(HTTP_RETRIES, 0);
}

/**
 * The single 401-refresh orchestrator (T2 §3.1 global-auth-fallback row;
 * ARCH-005 §3.4). One refresh path per grant kind, single-flight — the
 * direct port of the merged React-on-Java client's `attemptTokenRefresh`
 * (MIG-034 `lib/apiClient.ts`):
 * - `local` grant — frozen contract `POST /api/auth/refresh-token`
 *   `{refreshToken}` → `{accessToken, refreshToken}` rotation.
 * - `oidc` grant — embedded AS `POST {issuer}/oauth2/token`
 *   `grant_type=refresh_token` (public client, rotation).
 *
 * Consumes ANG-004's `TokenStorageService` (reads the pair, stores the
 * rotated pair, clears on failure) — token persistence is never
 * duplicated here. On an unrecoverable session the forced re-login clears
 * every local auth trace and navigates to `/login` IN-SPA (surfaced
 * improvement over the React hard `window.location` redirect).
 */
@Injectable({ providedIn: 'root' })
export class AuthRefreshService {
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStorageService);
  private readonly router = inject(Router);

  /** Prevents multiple concurrent refresh requests (single-flight). */
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * Refresh the stored grant (rotated on use). Concurrent callers share
   * one request; answers `false` when the session cannot be recovered —
   * the caller must then force re-login.
   */
  refresh(): Promise<boolean> {
    const refreshToken = this.tokens.getRefreshToken();
    const kind = this.tokens.getTokenKind();
    if (!refreshToken || !kind) {
      return Promise.resolve(false);
    }
    if (!this.refreshPromise) {
      this.refreshPromise = this.attempt(refreshToken, kind).finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  /** Forced re-login: clear every trace of local auth state, then redirect. */
  forceReLogin(): void {
    this.tokens.clear();
    void this.router.navigate(['/login']);
  }

  private async attempt(refreshToken: string, kind: TokenKind): Promise<boolean> {
    try {
      const rotated =
        kind === 'oidc'
          ? await this.refreshOidcGrant(refreshToken)
          : await this.refreshLocalGrant(refreshToken);
      if (!rotated) {
        return false;
      }
      this.tokens.setTokens(rotated.accessToken, rotated.refreshToken, kind);
      return true;
    } catch {
      return false;
    }
  }

  /** POST /api/auth/refresh-token — rotation for the local (MIG-030) grant. */
  private async refreshLocalGrant(refreshToken: string): Promise<AuthRefreshResponse | null> {
    const body: RefreshTokenRequest = { refreshToken };
    return firstValueFrom(
      this.http.post<AuthRefreshResponse>('/api/auth/refresh-token', body, {
        context: refreshCallContext(),
      }),
    );
  }

  /** POST {issuer}/oauth2/token — refresh-grant rotation for the AS grant. */
  private async refreshOidcGrant(refreshToken: string): Promise<AuthRefreshResponse | null> {
    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: environment.oidcClientId,
    });
    const response = await firstValueFrom(
      this.http.post<Partial<Record<'access_token' | 'refresh_token', string>>>(
        `${environment.oidcIssuer}/oauth2/token`,
        form.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, context: refreshCallContext() },
      ),
    );
    if (!response['access_token'] || !response['refresh_token']) {
      return null;
    }
    return { accessToken: response['access_token'], refreshToken: response['refresh_token'] };
  }
}
