/**
 * User Domain Type
 */

export interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'user';
  status: 'active' | 'disabled';
  createdAt: string;
  updatedAt: string;
}
