import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { TokenStorageService } from './token-storage.service';

/**
 * OIDC Service (React `services/oidc.service.ts` port — MIG-034; ADR-025
 * AS role, MIG-033).
 *
 * Browser authorization-code + PKCE (S256) flow against the embedded
 * Spring Authorization Server as the registered public SPA client
 * (`yacc-frontend`). The resource owner authenticates the authorization
 * request with the ordinary local Bearer access token (the MIG-033
 * resource-owner seam); consent is always required, so the dance is
 * authorize → consent submit → code at the registered `/auth/callback`
 * route → code exchange at `/oauth2/token`.
 *
 * KISS pins (reference-identical): framework-default endpoint paths
 * (`/oauth2/authorize`, `/oauth2/token`, `/oauth2/revoke` — pinned by
 * MIG-033, OUTSIDE the frozen `/api` contract), issuer/client-id from
 * build-time environment, same-origin topology (the redirect follow
 * requires it). ID-token signature/nonce verification is deliberately NOT
 * re-implemented in the SPA — the server validates every token it
 * consumes; identity resolution rides `GET /api/auth/get-session`.
 *
 * Transport note: this service uses `fetch`, not HttpClient, because the
 * authorization step MUST observe the post-redirect final URL (consent vs
 * callback detection); XHR/HttpClient does not expose it. This is the
 * reference implementation's own transport choice, confined to this one
 * service and to the MIG-033 AS endpoints — every frozen `/api/auth/*`
 * call stays on HttpClient in `AuthService`.
 */
@Injectable({ providedIn: 'root' })
export class OidcService {
  /** SPA callback route — the registered public-client redirect URI. */
  static readonly CALLBACK_PATH = '/auth/callback';

  /** Granted scopes (MIG-033 defaults: openid profile email). */
  private static readonly SCOPES = ['openid', 'profile', 'email'];

  private static readonly VERIFIER_KEY = 'yacc_oidc_verifier';
  private static readonly STATE_KEY = 'yacc_oidc_state';

  constructor(private readonly tokens: TokenStorageService) {}

  /**
   * Start the OIDC login: stashes the PKCE verifier + state, drives the
   * Bearer-authenticated authorization request (submitting consent — it is
   * always required), and navigates the browser to the callback URL
   * carrying the authorization code. Requires a current local access
   * token.
   */
  async beginLogin(accessToken: string): Promise<void> {
    const verifier = OidcService.randomToken();
    const state = OidcService.randomToken();
    sessionStorage.setItem(OidcService.VERIFIER_KEY, verifier);
    sessionStorage.setItem(OidcService.STATE_KEY, state);

    const redirectUri = `${window.location.origin}${OidcService.CALLBACK_PATH}`;
    const authorizeParams = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId(),
      redirect_uri: redirectUri,
      scope: OidcService.SCOPES.join(' '),
      state,
      nonce: OidcService.randomToken(),
      code_challenge: await OidcService.codeChallenge(verifier),
      code_challenge_method: 'S256',
    });

    const authorizeUrl = `${this.issuer()}/oauth2/authorize?${authorizeParams}`;
    const response = await fetch(authorizeUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let finalUrl = response.url;
    if (response.ok && !finalUrl.includes(OidcService.CALLBACK_PATH)) {
      // Consent is always required (MIG-033 policy): the 200 body is the
      // framework consent page whose form carries a fresh consent state.
      const consentState = OidcService.extractConsentState(await response.text());
      const consentResponse = await fetch(`${this.issuer()}/oauth2/authorize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId(),
          state: consentState,
          ...Object.fromEntries(OidcService.SCOPES.map((scope) => ['scope', scope])),
        }),
      });
      finalUrl = consentResponse.url;
    }

    if (!response.ok || !finalUrl.includes(OidcService.CALLBACK_PATH)) {
      throw new Error('OIDC authorization failed');
    }

    // Navigate the browser to the callback (same-origin redirect follow).
    window.location.assign(finalUrl);
  }

  /**
   * Complete the OIDC login at the callback: validate `state`, exchange
   * the code (PKCE verifier) at `/oauth2/token`, and adopt the rotated AS
   * token pair as the SPA session (kind `oidc`).
   */
  async completeLogin(code: string, state: string): Promise<void> {
    const expectedState = sessionStorage.getItem(OidcService.STATE_KEY);
    const verifier = sessionStorage.getItem(OidcService.VERIFIER_KEY);
    sessionStorage.removeItem(OidcService.STATE_KEY);
    sessionStorage.removeItem(OidcService.VERIFIER_KEY);

    if (!expectedState || !verifier || state !== expectedState) {
      throw new Error('Invalid OIDC state');
    }

    const response = await fetch(`${this.issuer()}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${window.location.origin}${OidcService.CALLBACK_PATH}`,
        client_id: this.clientId(),
        code_verifier: verifier,
      }),
    });
    if (!response.ok) {
      throw new Error('OIDC token exchange failed');
    }

    const tokens = (await response.json()) as TokenEndpointResponse;
    this.tokens.setTokens(tokens.access_token, tokens.refresh_token, 'oidc');
  }

  /**
   * Revoke the AS refresh grant at `/oauth2/revoke` (logout). Best-effort:
   * local state clearing is the caller's unconditional next step.
   */
  async revokeGrant(refreshToken: string): Promise<void> {
    await fetch(`${this.issuer()}/oauth2/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: refreshToken,
        client_id: this.clientId(),
      }),
    }).catch(() => undefined);
  }

  /** AS issuer base URL. Empty = same origin (default topology). */
  private issuer(): string {
    return environment.oidcIssuer;
  }

  /** Registered public client id (MIG-033 default: `yacc-frontend`). */
  private clientId(): string {
    return environment.oidcClientId;
  }

  /** base64url of a byte string. */
  private static base64url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /** Random base64url string (32 bytes of entropy). */
  private static randomToken(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return OidcService.base64url(bytes);
  }

  /** PKCE S256 challenge for a verifier. */
  private static async codeChallenge(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return OidcService.base64url(new Uint8Array(digest));
  }

  /** Extract the consent `state` hidden field from the consent page form. */
  private static extractConsentState(html: string): string {
    const match = /name="state" value="([^"]+)"/.exec(html);
    if (!match) {
      throw new Error('OIDC consent state missing');
    }
    return match[1];
  }
}

/** Token-endpoint response (RFC 6749 §5.1 — snake_case wire form). */
interface TokenEndpointResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}
