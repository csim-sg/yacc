import type { Role } from './Role.type';

export interface AuthSession {
  userId: string;
  email: string;
  role: Role;
}
