import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard for public-only routes (React `PublicRoute` port — UX only; the
 * Spring Security backend remains the security boundary).
 *
 * Awaits the one-time session restore, then:
 * - authenticated → redirect to `/inbox` (signed-in users never see auth forms);
 * - not authenticated → allow.
 */
export const publicGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSessionLoaded().then(() =>
    auth.isAuthenticated() ? router.createUrlTree(['/inbox']) : true
  );
};
