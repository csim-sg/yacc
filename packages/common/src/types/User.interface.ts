import type { Timestamp } from './Timestamp.interface';
import type { Role } from './Role.type';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User extends Timestamp {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  lastLoginAt?: string;
}
