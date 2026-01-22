import type { Role } from './Role.type';
import type { UserStatus } from './UserStatus.type';

export interface UpdateUserRequest {
  role?: Role;
  status?: UserStatus;
  password?: string;
}
