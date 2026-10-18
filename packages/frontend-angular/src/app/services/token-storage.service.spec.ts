import { TestBed } from '@angular/core/testing';
import { TokenStorageService } from './token-storage.service';

/**
 * TokenStorageService spec (ANG-004, U6 resolution).
 *
 * Pins the parity-required storage keys (`yacc_token` /
 * `yacc_refresh_token` / `yacc_token_kind` — asserted by the Tier-0
 * `frontend-login.spec.ts`), the grant-kind validation, and the
 * clear-all-local-auth-state semantics (including the legacy POC keys).
 */
describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'auth_token=; Max-Age=0; path=/';
    document.cookie = 'session=; Max-Age=0; path=/';
    service = TestBed.inject(TokenStorageService);
  });

  it('stores and reads the token pair with its grant kind under the parity keys', () => {
    service.setTokens('access-1', 'refresh-1', 'local');

    expect(localStorage.getItem('yacc_token')).toBe('access-1');
    expect(localStorage.getItem('yacc_refresh_token')).toBe('refresh-1');
    expect(localStorage.getItem('yacc_token_kind')).toBe('local');

    expect(service.getAccessToken()).toBe('access-1');
    expect(service.getRefreshToken()).toBe('refresh-1');
    expect(service.getTokenKind()).toBe('local');
  });

  it('stores the oidc grant kind for AS-adopted sessions', () => {
    service.setTokens('as-access', 'as-refresh', 'oidc');
    expect(service.getTokenKind()).toBe('oidc');
  });

  it('reads null before anything is stored', () => {
    expect(service.getAccessToken()).toBeNull();
    expect(service.getRefreshToken()).toBeNull();
    expect(service.getTokenKind()).toBeNull();
  });

  it('reads an unknown stored kind as null (fail-safe)', () => {
    localStorage.setItem('yacc_token_kind', 'betterauth');
    expect(service.getTokenKind()).toBeNull();
  });

  it('clears the pair and the legacy POC keys on clear()', () => {
    service.setTokens('access-1', 'refresh-1', 'local');
    localStorage.setItem('auth_token', 'legacy-poc-token');
    document.cookie = 'auth_token=stale; path=/';
    document.cookie = 'session=stale; path=/';

    service.clear();

    expect(localStorage.getItem('yacc_token')).toBeNull();
    expect(localStorage.getItem('yacc_refresh_token')).toBeNull();
    expect(localStorage.getItem('yacc_token_kind')).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(document.cookie).not.toContain('auth_token=stale');
    expect(document.cookie).not.toContain('session=stale');
  });
});
