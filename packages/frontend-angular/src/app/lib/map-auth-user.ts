import type { AuthUser } from '../contracts/http/auth.schema';
import type { UiUser } from '../types/user';
import { normalizeRole } from './normalize-role';

/**
 * Map the canonical wire user (`AuthUser`, lowercase role) onto the UI
 * shape (`UiUser`, uppercase role) — the single auth-boundary mapping
 * (React `AuthContext.toUiUser` parity). Role normalization happens here
 * and nowhere else (T3-G9).
 */
export function toUiUser(user: AuthUser): UiUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: normalizeRole(user.role),
    status: user.status,
    createdAt: user.createdAt,
  };
}
