import type { RoleType } from './role';

/**
 * UI-facing user view model (React `AuthContext` `User` parity).
 *
 * The normalized uppercase role makes every RBAC read
 * (`Navigation` config, `roleGuard`) consume one canonical shape; the
 * wire user (`contracts/http/auth.schema.ts` `AuthUser`) is mapped onto
 * this exactly once, in `lib/map-auth-user.ts` at the auth boundary.
 */
export interface UiUser {
  id: string;
  email: string;
  name: string;
  role: RoleType;
  status: string;
  createdAt?: string;
}
