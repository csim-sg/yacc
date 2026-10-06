import { z } from 'zod';

/**
 * Wire role labels — canonical LOWERCASE (T3 §4.3, gap G9).
 *
 * This is the wire form: what the backend `@Authorized` guards check and
 * what auth responses carry (`super_admin | admin | manager | user`).
 * Normalization to the uppercase UI labels happens exactly once at the
 * auth boundary (AuthService, ANG-004) — never inside services or
 * contracts. Do NOT introduce an uppercase enum here.
 */
export const RoleSchema = z.enum(['super_admin', 'admin', 'manager', 'user']);

export type Role = z.infer<typeof RoleSchema>;

/** Wire user-status labels — lowercase (backend enum values). */
export const UserStatusSchema = z.enum(['active', 'inactive', 'suspended']);

export type UserStatus = z.infer<typeof UserStatusSchema>;
