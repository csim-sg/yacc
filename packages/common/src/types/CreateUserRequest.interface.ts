import type { Role } from './Role.type';

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: Role;
}
