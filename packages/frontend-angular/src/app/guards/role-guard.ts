import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { meetsRoleRequirement } from '../lib/navigation';
import type { RoleType } from '../types/role';
import { AuthService } from '../services/auth.service';

/**
 * Role-gated route guard factory (React `ProtectedRoute requiredRole`
 * port with the `ROLE_HIERARCHY` semantics — UX only; the Spring Security
 * backend remains the security boundary).
 *
 * Awaits the one-time session restore, then:
 * - not authenticated → redirect to `/login`;
 * - authenticated but the hierarchy requirement is NOT met → redirect to
 *   `/inbox` (React parity: insufficient permissions never show an error page);
 * - requirement met → allow.
 *
 * @param requiredRole minimum role required (USER 1 < MANAGER 2 < ADMIN 3 < SUPER_ADMIN 4)
 */
export function roleGuard(requiredRole: RoleType): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    return auth.ensureSessionLoaded().then(() => {
      const user = auth.user();
      if (!auth.isAuthenticated() || !user) {
        return router.createUrlTree(['/login']);
      }
      return meetsRoleRequirement(user.role, requiredRole)
        ? true
        : router.createUrlTree(['/inbox']);
    });
  };
}
