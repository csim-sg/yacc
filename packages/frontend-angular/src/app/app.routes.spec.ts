import { routes } from './app.routes';
import { AppShell } from './components/app-shell/app-shell';
import { Inbox } from './pages/inbox/inbox';

/**
 * Route-table spec (ANG-004 auth slice + ANG-007 shell slice).
 *
 * Pins the route matrix: public auth forms behind `publicGuard`, the
 * unguarded OIDC redirect-uri route, the authGuard-protected
 * forced-credential-change route, the shared authenticated shell group
 * (`AppShell` wrapping the feature routes behind `authGuard`), and the
 * `/inbox` catch-all redirect (React `path="*"` parity).
 */
describe('routes', () => {
  it('defines exactly the six auth routes plus the shell group and the catch-all', () => {
    expect(routes.map((route) => route.path)).toEqual([
      'login',
      'register',
      'forgot-password',
      'reset-password',
      'auth/callback',
      'change-password',
      '',
      '**',
    ]);
  });

  it('guards the public auth forms with publicGuard', () => {
    for (const path of ['login', 'register', 'forgot-password', 'reset-password']) {
      const route = routes.find((candidate) => candidate.path === path);
      expect(route?.canActivate).toBeDefined();
    }
  });

  it('leaves the OIDC redirect-uri route unguarded', () => {
    const callback = routes.find((candidate) => candidate.path === 'auth/callback');
    expect(callback?.canActivate).toBeUndefined();
  });

  it('guards the forced credential change with authGuard', () => {
    const change = routes.find((candidate) => candidate.path === 'change-password');
    expect(change?.canActivate).toBeDefined();
  });

  it('wraps the authenticated feature routes in the shell behind authGuard', () => {
    const shell = routes.find((candidate) => candidate.path === '');
    expect(shell?.component).toBe(AppShell);
    expect(shell?.canActivate).toBeDefined();

    const children = shell?.children ?? [];
    expect(children.map((child) => child.path)).toEqual(['inbox', '']);
    expect(children[0]?.component).toBe(Inbox);
    // The empty child redirects to /inbox (React `/` → inbox parity).
    expect(children[1]?.redirectTo).toBe('inbox');
  });

  it('redirects unknown paths to /inbox (React `path="*"` parity)', () => {
    const catchAll = routes.find((candidate) => candidate.path === '**');
    expect(catchAll?.redirectTo).toBe('inbox');
  });
});
