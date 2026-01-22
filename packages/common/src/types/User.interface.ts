import type { Timestamp } from './Timestamp.interface';
import type { Role } from './Role.type';
import type { UserStatus } from './UserStatus.type';

export interface User extends Timestamp {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
}
