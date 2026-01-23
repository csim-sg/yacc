import type { User } from './User.interface';

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}
