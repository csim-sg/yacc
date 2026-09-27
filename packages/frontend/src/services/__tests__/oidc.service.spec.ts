/**
 * Unit tests for the OIDC browser flow (MIG-034; MIG-033 embedded AS):
 * PKCE authorization request with state/nonce binding, consent submission,
 * code exchange with the verified state, and session adoption.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getToken, getTokenKind } from '../../lib/apiClient';
import { beginOidcLogin, completeOidcLogin, revokeOidcGrant } from '../oidc.service';

function jsonResponse(status: number, body: string, url = 'http://localhost:3000/ignored'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as Response;
}

const CONSENT_HTML = `<!doctype html><html><body>
<form method="post">
  <input type="hidden" name="client_id" value="yacc-frontend" />
  <input type="hidden" name="state" value="consent-state-123" />
</form>
</body></html>`;

describe('oidcService (embedded AS browser flow)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('drives authorize + consent and lands on the callback with the code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, CONSENT_HTML, 'http://localhost:3000/oauth2/authorize?response_type=code')
      )
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          '',
          'http://localhost:5173/auth/callback?code=the-code&state=the-state'
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    // Navigating the browser is a jsdom no-op ("Not implemented"); the
    // real navigation is covered by the Playwright callback E2E.
    await expect(beginOidcLogin('access-jwt')).resolves.toBeUndefined();

    const [authorizeUrl, authorizeInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(authorizeUrl).toContain('/oauth2/authorize?');
    expect(authorizeUrl).toContain('response_type=code');
    expect(authorizeUrl).toContain('client_id=yacc-frontend');
    expect(authorizeUrl).toContain('code_challenge_method=S256');
    expect(authorizeUrl).toContain('state=');
    expect((authorizeInit.headers as Record<string, string>).Authorization).toBe(
      'Bearer access-jwt'
    );

    const [consentUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(consentUrl).toBe('/oauth2/authorize');
    // The PKCE verifier + state survive for the callback exchange.
    expect(sessionStorage.getItem('yacc_oidc_state')).toBeTruthy();
    expect(sessionStorage.getItem('yacc_oidc_verifier')).toBeTruthy();
  });

  it('exchanges the code at the token endpoint and adopts the AS session', async () => {
    sessionStorage.setItem('yacc_oidc_state', 'the-state');
    sessionStorage.setItem('yacc_oidc_verifier', 'the-verifier');
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, JSON.stringify({
        access_token: 'as-access',
        refresh_token: 'as-refresh',
        token_type: 'Bearer',
        expires_in: 1800,
        scope: 'openid profile email',
      }))
    );
    vi.stubGlobal('fetch', fetchMock);

    await completeOidcLogin('the-code', 'the-state');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/oauth2/token');
    const body = String(init.body);
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('code=the-code');
    expect(body).toContain('code_verifier=the-verifier');
    expect(body).toContain('client_id=yacc-frontend');
    expect(getToken()).toBe('as-access');
    expect(getTokenKind()).toBe('oidc');
    // One-time material consumed.
    expect(sessionStorage.getItem('yacc_oidc_state')).toBeNull();
    expect(sessionStorage.getItem('yacc_oidc_verifier')).toBeNull();
  });

  it('rejects the exchange when the state does not match (CSRF binding)', async () => {
    sessionStorage.setItem('yacc_oidc_state', 'the-state');
    sessionStorage.setItem('yacc_oidc_verifier', 'the-verifier');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(completeOidcLogin('the-code', 'forged-state')).rejects.toThrow(
      'Invalid OIDC state'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revokes the AS refresh grant at /oauth2/revoke', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, '{}'));
    vi.stubGlobal('fetch', fetchMock);

    await revokeOidcGrant('as-refresh');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/oauth2/revoke');
    expect(String(init.body)).toContain('token=as-refresh');
  });
});
