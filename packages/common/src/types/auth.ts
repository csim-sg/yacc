/**
 * Authentication Types
 * JWT and session-related types
 */
import { ROLES, USER_STATUSES } from '../constants';

export type Role = typeof ROLES[keyof typeof ROLES];
export type UserStatus = typeof USER_STATUSES[keyof typeof USER_STATUSES];

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface AuthSession {
  userId: string;
  email: string;
  role: Role;
}
