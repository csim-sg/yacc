import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth-guard';
import { publicGuard } from './public-guard';
import { roleGuard } from './role-guard';

/**
 * Guard matrix spec (ANG-004, AC-ANG-004-3 — W23).
 *
 * Exercises the auth/public/role guard matrix across all four roles plus
 * the unknown-role normalization path (unknown → USER at the auth
 * boundary), mirroring the React `ProtectedRoute`/`PublicRoute` +
 * `ROLE_HIERARCHY` behavior. Guards are UX only — the Spring Security
 * backend remains the security boundary.
 */
describe('auth guards', () => {
  /** Canonical wire session for a lowercase wire role (frozen contract). */
  function wireSession(role: string): { user: Record<string, unknown>; mustChangePassword: boolean } {
    return {
      user: {
        id: '00000000-0000-0000-0000-00000000000a',
        email: 'user@yacc.local',
        name: 'Matrix User',
        role,
        status: 'active',
        emailVerified: true,
        createdAt: '2026-10-18T00:00:00',
        updatedAt: '2026-10-18T00:00:00',
      },
      mustChangePassword: false,
    };
  }

  function flushSession(session: Record<string, unknown> | null): void {
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne('/api/auth/get-session');
    if (session === null) {
      request.flush({ error: 'Missing or invalid token' }, { status: 401, statusText: 'Unauthorized' });
    } else {
      request.flush(session);
    }
  }

  function runGuard(guard: CanActivateFn): Promise<boolean | UrlTree> {
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as Promise<boolean | UrlTree>;
  }

  /** Fresh injector per case — resets the memoized session init load. */
  function freshTestBed(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  }

  function serialized(result: boolean | UrlTree): string {
    // Boolean `true` renders "<allowed>"; a UrlTree serializes to its path.
    if (typeof result !== 'boolean') {
      return TestBed.inject(Router).serializeUrl(result);
    }
    return '<allowed>';
  }

  beforeEach(() => {
    localStorage.clear();
    document.cookie = 'auth_token=; Max-Age=0; path=/';
    document.cookie = 'session=; Max-Age=0; path=/';
    freshTestBed();
  });

  describe('authGuard', () => {
    it('redirects an anonymous visitor to /login', async () => {
      expect(serialized(await runGuard(authGuard))).toBe('/login');
    });

    it('redirects to /login when the stored token is rejected (401)', async () => {
      localStorage.setItem('yacc_token', 'access-stale');
      const pending = runGuard(authGuard);
      flushSession(null);
      expect(serialized(await pending)).toBe('/login');
      // Session loss cleared the local auth state (forced re-login).
      expect(localStorage.getItem('yacc_token')).toBeNull();
    });

    it('allows an authenticated user through', async () => {
      localStorage.setItem('yacc_token', 'access-1');
      const pending = runGuard(authGuard);
      flushSession(wireSession('user'));
      expect(serialized(await pending)).toBe('<allowed>');
    });
  });

  describe('publicGuard', () => {
    it('allows an anonymous visitor onto the auth form', async () => {
      expect(serialized(await runGuard(publicGuard))).toBe('<allowed>');
    });

    it('redirects an authenticated user to /inbox', async () => {
      localStorage.setItem('yacc_token', 'access-1');
      const pending = runGuard(publicGuard);
      flushSession(wireSession('user'));
      expect(serialized(await pending)).toBe('/inbox');
    });
  });

  describe('roleGuard — role × requirement matrix (W23)', () => {
    it('admits each role exactly per the hierarchy', async () => {
      const matrix: Array<{
        wireRole: string;
        requiredRole: 'USER' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN';
        expected: string;
      }> = [
        { wireRole: 'super_admin', requiredRole: 'USER', expected: '<allowed>' },
        { wireRole: 'super_admin', requiredRole: 'MANAGER', expected: '<allowed>' },
        { wireRole: 'super_admin', requiredRole: 'ADMIN', expected: '<allowed>' },
        { wireRole: 'super_admin', requiredRole: 'SUPER_ADMIN', expected: '<allowed>' },
        { wireRole: 'admin', requiredRole: 'USER', expected: '<allowed>' },
        { wireRole: 'admin', requiredRole: 'MANAGER', expected: '<allowed>' },
        { wireRole: 'admin', requiredRole: 'ADMIN', expected: '<allowed>' },
        { wireRole: 'admin', requiredRole: 'SUPER_ADMIN', expected: '/inbox' },
        { wireRole: 'manager', requiredRole: 'USER', expected: '<allowed>' },
        { wireRole: 'manager', requiredRole: 'MANAGER', expected: '<allowed>' },
        { wireRole: 'manager', requiredRole: 'ADMIN', expected: '/inbox' },
        { wireRole: 'manager', requiredRole: 'SUPER_ADMIN', expected: '/inbox' },
        { wireRole: 'user', requiredRole: 'USER', expected: '<allowed>' },
        { wireRole: 'user', requiredRole: 'MANAGER', expected: '/inbox' },
        { wireRole: 'user', requiredRole: 'ADMIN', expected: '/inbox' },
        { wireRole: 'user', requiredRole: 'SUPER_ADMIN', expected: '/inbox' },
      ];

      for (const { wireRole, requiredRole, expected } of matrix) {
        freshTestBed();
        localStorage.setItem('yacc_token', `access-${wireRole}`);
        const pending = runGuard(roleGuard(requiredRole));
        flushSession(wireSession(wireRole));
        expect(serialized(await pending), `${wireRole} → ${requiredRole}`).toBe(expected);
      }
    });

    it('redirects an unauthenticated visitor to /login regardless of role', async () => {
      expect(serialized(await runGuard(roleGuard('SUPER_ADMIN')))).toBe('/login');
    });

    it('treats an unknown wire role as USER via the auth-boundary normalization', async () => {
      freshTestBed();
      localStorage.setItem('yacc_token', 'access-unknown');
      const pendingManager = runGuard(roleGuard('MANAGER'));
      flushSession(wireSession('some_future_role'));
      expect(serialized(await pendingManager)).toBe('/inbox');

      freshTestBed();
      localStorage.setItem('yacc_token', 'access-unknown-2');
      const pendingUser = runGuard(roleGuard('USER'));
      flushSession(wireSession('some_future_role'));
      expect(serialized(await pendingUser)).toBe('<allowed>');
    });
  });
});
