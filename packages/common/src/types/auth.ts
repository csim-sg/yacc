/**
 * Authentication Types
 * JWT and session-related types
 */
import { ROLES } from '../constants';
export type Role = typeof ROLES[keyof typeof ROLES];

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
