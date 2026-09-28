/**
 * OIDC Service (MIG-034; ADR-025 AS role, MIG-033)
 *
 * Browser authorization-code + PKCE (S256) flow against the embedded
 * Spring Authorization Server as the registered public SPA client
 * (`yacc-frontend`). The resource owner authenticates the authorization
 * request with the ordinary local Bearer access token (the MIG-033
 * resource-owner seam); consent is always required, so the dance is
 * authorize → consent submit → code at the registered `/auth/callback`
 * route → code exchange at `/oauth2/token`.
 *
 * KISS pins: framework-default endpoint paths (`/oauth2/authorize`,
 * `/oauth2/token`, `/oauth2/revoke` — pinned by MIG-033, outside the
 * frozen `/api` contract), issuer/client-id from environment, same-origin
 * topology (the redirect follow requires it). ID-token signature/nonce
 * verification is deliberately NOT re-implemented in the SPA — the server
 * validates every token it consumes; identity resolution rides
 * `GET /api/auth/get-session`.
 */

import { setTokens } from '../lib/apiClient';

/** AS issuer base URL. Empty = same origin (default deployment topology). */
function getIssuer(): string {
  return (import.meta.env.VITE_OIDC_ISSUER as string | undefined) || '';
}

/** Registered public client id (MIG-033 default: `yacc-frontend`). */
function getClientId(): string {
  return (import.meta.env.VITE_OIDC_CLIENT_ID as string | undefined) || 'yacc-frontend';
}

/** SPA callback route (matches the registered exact-match redirect URI). */
export const OIDC_CALLBACK_PATH = '/auth/callback';

/** Granted scopes (MIG-033 defaults: openid profile email). */
const SCOPES = ['openid', 'profile', 'email'];

const VERIFIER_KEY = 'yacc_oidc_verifier';
const STATE_KEY = 'yacc_oidc_state';

interface TokenEndpointResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/** base64url of a byte string. */
function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Random base64url string (32 bytes of entropy). */
function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** PKCE S256 challenge for a verifier. */
async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return base64url(new Uint8Array(digest));
}

/**
 * Start the OIDC login: stashes the PKCE verifier + state, drives the
 * Bearer-authenticated authorization request (submitting consent — it is
 * always required), and navigates the browser to the callback URL carrying
 * the authorization code. Requires a current local access token.
 */
export async function beginOidcLogin(accessToken: string): Promise<void> {
  const verifier = randomToken();
  const state = randomToken();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const redirectUri = `${window.location.origin}${OIDC_CALLBACK_PATH}`;
  const authorizeParams = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
    nonce: randomToken(),
    code_challenge: await codeChallenge(verifier),
    code_challenge_method: 'S256',
  });

  const authorizeUrl = `${getIssuer()}/oauth2/authorize?${authorizeParams}`;
  const response = await fetch(authorizeUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  let finalUrl = response.url;
  if (response.ok && !finalUrl.includes(OIDC_CALLBACK_PATH)) {
    // Consent is always required (MIG-033 policy): the 200 body is the
    // framework consent page whose form carries a fresh consent state.
    const consentState = extractConsentState(await response.text());
    const consentResponse = await fetch(`${getIssuer()}/oauth2/authorize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: getClientId(),
        state: consentState,
        ...Object.fromEntries(SCOPES.map((scope) => ['scope', scope])),
      }),
    });
    finalUrl = consentResponse.url;
  }

  if (!response.ok || !finalUrl.includes(OIDC_CALLBACK_PATH)) {
    throw new Error('OIDC authorization failed');
  }

  // Navigate the browser to the callback (same-origin redirect follow).
  window.location.assign(finalUrl);
}

/** Extract the consent `state` hidden field from the consent page form. */
function extractConsentState(html: string): string {
  const match = /name="state" value="([^"]+)"/.exec(html);
  if (!match) {
    throw new Error('OIDC consent state missing');
  }
  return match[1];
}

/**
 * Complete the OIDC login at the callback: validate `state`, exchange the
 * code (PKCE verifier) at `/oauth2/token`, and adopt the rotated AS token
 * pair as the SPA session (kind `oidc`).
 */
export async function completeOidcLogin(code: string, state: string): Promise<void> {
  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);

  if (!expectedState || !verifier || state !== expectedState) {
    throw new Error('Invalid OIDC state');
  }

  const response = await fetch(`${getIssuer()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${window.location.origin}${OIDC_CALLBACK_PATH}`,
      client_id: getClientId(),
      code_verifier: verifier,
    }),
  });
  if (!response.ok) {
    throw new Error('OIDC token exchange failed');
  }

  const tokens = (await response.json()) as TokenEndpointResponse;
  setTokens(tokens.access_token, tokens.refresh_token, 'oidc');
}

/**
 * Revoke the AS refresh grant at `/oauth2/revoke` (logout). Best-effort:
 * local state clearing is the caller's unconditional next step.
 */
export async function revokeOidcGrant(refreshToken: string): Promise<void> {
  await fetch(`${getIssuer()}/oauth2/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: refreshToken,
      client_id: getClientId(),
    }),
  }).catch(() => undefined);
}
