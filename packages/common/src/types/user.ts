/**
 * User Types
 */

import type { Role, Timestamp } from './domain';

export interface User extends Timestamp {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: 'active' | 'inactive' | 'suspended';
}

export interface UserProfile extends User {
  avatar?: string;
  bio?: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: AuthToken;
}
