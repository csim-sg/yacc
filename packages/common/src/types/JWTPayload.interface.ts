import type { Role } from './Role.type';

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}
