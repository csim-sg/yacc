import { TestBed } from '@angular/core/testing';
import { OidcService } from './oidc.service';
import { TokenStorageService } from './token-storage.service';

/**
 * OidcService spec (ANG-004 — MIG-034/MIG-033 port; U6 `oidc` grant).
 *
 * Covers the browser authorization-code + PKCE (S256) dance against the
 * embedded Spring Authorization Server: verifier/state stashing (the
 * Tier-0 `frontend-login.spec.ts` asserts the `yacc_oidc_state` /
 * `yacc_oidc_verifier` sessionStorage keys), consent auto-submit, the
 * `/auth/callback` redirect target, callback completion (state check +
 * code exchange → adopted AS pair, kind `oidc`), forged-state rejection,
 * and best-effort AS-grant revocation at logout.
 */
describe('OidcService', () => {
  /** A Response with a settable final URL (redirect-follow visibility). */
  function responseWithUrl(body: string, url: string, init?: ResponseInit): Response {
    return Object.assign(new Response(body, init), { url });
  }

  const CALLBACK_URL = 'http://localhost/auth/callback?code=the-code&state=the-state';

  let service: OidcService;
  let tokens: TokenStorageService;
  let fetchMock: ReturnType<typeof vi.fn>;
  let assignSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(OidcService);
    tokens = TestBed.inject(TokenStorageService);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    assignSpy.mockRestore();
  });

  describe('beginLogin', () => {
    it('stashes the PKCE verifier + state and drives the Bearer-authenticated authorization request', async () => {
      fetchMock.mockResolvedValueOnce(responseWithUrl('', CALLBACK_URL, { status: 200 }));

      await service.beginLogin('access-jwt');

      expect(sessionStorage.getItem('yacc_oidc_state')).toBeTruthy();
      expect(sessionStorage.getItem('yacc_oidc_verifier')).toBeTruthy();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.startsWith('/oauth2/authorize') || url.includes('/oauth2/authorize?')).toBe(true);
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=yacc-frontend');
      expect(url).toContain('scope=openid+profile+email');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('code_challenge=');
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer access-jwt');

      // The browser is navigated to the registered redirect URI.
      expect(assignSpy).toHaveBeenCalledWith(expect.stringContaining('/auth/callback'));
    });

    it('auto-submits the always-required consent page, then navigates to the callback', async () => {
      const consentHtml = '<form><input name="state" value="consent-state-1"/></form>';
      fetchMock
        .mockResolvedValueOnce(responseWithUrl(consentHtml, 'http://localhost/oauth2/authorize', { status: 200 }))
        .mockResolvedValueOnce(responseWithUrl('', CALLBACK_URL, { status: 200 }));

      await service.beginLogin('access-jwt');

      const [, consentInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(String(consentInit.body)).toContain('state=consent-state-1');
      expect(new Headers(consentInit.headers).get('Authorization')).toBe('Bearer access-jwt');
      expect(assignSpy).toHaveBeenCalledWith(expect.stringContaining('/auth/callback'));
    });

    it('throws when the dance does not end at the callback', async () => {
      fetchMock.mockResolvedValueOnce(
        responseWithUrl('', 'http://localhost/oauth2/authorize?error=denied', { status: 500 })
      );

      await expect(service.beginLogin('access-jwt')).rejects.toThrow('OIDC authorization failed');
      expect(assignSpy).not.toHaveBeenCalled();
    });
  });

  describe('completeLogin', () => {
    beforeEach(() => {
      sessionStorage.setItem('yacc_oidc_state', 'the-state');
      sessionStorage.setItem('yacc_oidc_verifier', 'the-verifier');
    });

    it('validates state, exchanges the code with the verifier, and adopts the AS pair (kind oidc)', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'as-access-token',
            refresh_token: 'as-refresh-token',
            token_type: 'Bearer',
            expires_in: 1800,
            scope: 'openid profile email',
          }),
          { status: 200 }
        )
      );

      await service.completeLogin('the-code', 'the-state');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/oauth2/token');
      const body = String(init.body);
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('code=the-code');
      expect(body).toContain('code_verifier=the-verifier');
      expect(body).toContain('client_id=yacc-frontend');
      // URLSearchParams serializes with x-www-form-urlencoded escaping.
      expect(body).toContain(
        `redirect_uri=${encodeURIComponent(`${window.location.origin}/auth/callback`)}`
      );

      expect(tokens.getAccessToken()).toBe('as-access-token');
      expect(tokens.getRefreshToken()).toBe('as-refresh-token');
      expect(tokens.getTokenKind()).toBe('oidc');
      // One-shot PKCE material is consumed.
      expect(sessionStorage.getItem('yacc_oidc_state')).toBeNull();
      expect(sessionStorage.getItem('yacc_oidc_verifier')).toBeNull();
    });

    it('rejects a forged state and clears the PKCE material without storing tokens', async () => {
      await expect(service.completeLogin('the-code', 'forged-state')).rejects.toThrow(
        'Invalid OIDC state'
      );

      expect(tokens.getAccessToken()).toBeNull();
      expect(tokens.getTokenKind()).toBeNull();
      expect(sessionStorage.getItem('yacc_oidc_state')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects completion when the PKCE material is missing', async () => {
      sessionStorage.clear();
      await expect(service.completeLogin('the-code', 'the-state')).rejects.toThrow(
        'Invalid OIDC state'
      );
    });

    it('fails on a token-exchange error response', async () => {
      fetchMock.mockResolvedValueOnce(new Response('{"error":"invalid_grant"}', { status: 400 }));

      await expect(service.completeLogin('the-code', 'the-state')).rejects.toThrow(
        'OIDC token exchange failed'
      );
      expect(tokens.getAccessToken()).toBeNull();
    });
  });

  describe('revokeGrant', () => {
    it('posts the refresh grant + client id to /oauth2/revoke', async () => {
      fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));

      await service.revokeGrant('as-refresh-token');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/oauth2/revoke');
      const body = String(init.body);
      expect(body).toContain('token=as-refresh-token');
      expect(body).toContain('client_id=yacc-frontend');
    });

    it('is best-effort — a failed revoke does not throw', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      await expect(service.revokeGrant('as-refresh-token')).resolves.toBeUndefined();
    });
  });
});
