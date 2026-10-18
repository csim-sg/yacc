import type { RoleType } from '../types/role';

/**
 * Normalize a lowercase wire role to the UI role label (T3-G9).
 *
 * Applied exactly once at the auth boundary (`lib/map-auth-user.ts`); an
 * unknown label defaults to USER (least privilege), never thrown.
 */
export function normalizeRole(role: string): RoleType {
  const normalized = role.toUpperCase();
  if (normalized === 'SUPER_ADMIN' || normalized === 'ADMIN' || normalized === 'MANAGER' || normalized === 'USER') {
    return normalized;
  }
  return 'USER';
}
