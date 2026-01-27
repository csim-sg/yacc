/**
 * Create User Request
 * Body parameters for creating a new user
 */
export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role?: 'super_admin' | 'admin' | 'manager' | 'user';
}
