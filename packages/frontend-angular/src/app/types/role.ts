/**
 * UI-facing role labels — canonical UPPERCASE (T3 §4.3, gap G9).
 *
 * The wire contract is lowercase (`super_admin | admin | manager | user`,
 * `contracts/common/role.schema.ts`); normalization to these UI labels
 * happens exactly once at the auth boundary (`lib/normalize-role.ts`,
 * applied by `AuthService`) — never inside individual services.
 */
export type RoleType = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
