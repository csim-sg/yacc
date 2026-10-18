import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard for protected routes (React `ProtectedRoute` port — UX only; the
 * Spring Security backend remains the security boundary).
 *
 * Awaits the one-time session restore, then:
 * - authenticated → allow;
 * - not authenticated → redirect to `/login` (React `<Navigate to="/login" replace />`).
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.ensureSessionLoaded().then(() =>
    auth.isAuthenticated() ? true : router.createUrlTree(['/login'])
  );
};
