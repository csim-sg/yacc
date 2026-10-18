import { routes } from './app.routes';

/**
 * Auth route-table spec (ANG-004).
 *
 * Pins the auth/RBAC route matrix: public auth forms behind `publicGuard`,
 * the unguarded OIDC redirect-uri route, and the authGuard-protected
 * forced-credential-change route. Feature routes arrive with
 * ANG-007..013 and extend this table.
 */
describe('routes', () => {
  it('defines exactly the six auth routes', () => {
    expect(routes.map((route) => route.path)).toEqual([
      'login',
      'register',
      'forgot-password',
      'reset-password',
      'auth/callback',
      'change-password',
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
});
