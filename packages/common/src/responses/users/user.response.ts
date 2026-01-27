/**
 * User Response
 * Response shape for user endpoints
 */
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  emailVerified?: boolean;
  createdAt: Date;
}

export interface UserListResponse {
  success: boolean;
  data?: UserResponse[];
  page?: number;
  limit?: number;
  total?: number;
}

export interface UserCreateResponse extends UserResponse {
  message?: string;
}

export interface UserDeleteResponse {
  success: boolean;
  message: string;
}
