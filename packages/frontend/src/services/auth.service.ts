/**
 * Authentication Service
 * Handles all auth-related API calls using BetterAuth
 */

import { api, clearToken } from '../lib/api-client';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'manager' | 'user';
  status: 'active' | 'inactive' | 'suspended';
  emailVerified?: boolean;
  image?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// BetterAuth response format
export interface BetterAuthSession {
  id: string;
  userId: number;
  expiresAt: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResponse {
  user: User;
  session: BetterAuthSession;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  user: User;
  session?: BetterAuthSession;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface SessionResponse {
  user: User;
  session: BetterAuthSession;
}

/**
 * Auth Service
 * Integrated with BetterAuth endpoints
 */
export const authService = {
  /**
   * Login user (MVP simple auth)
   * Endpoint: POST /simple-auth/login
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/simple-auth/login', credentials);
    
    // Token is automatically extracted from 'set-auth-token' header in api-client
    // Refresh token is automatically sent via HttpOnly cookie
    
    return response;
  },

  /**
   * Register new user
   * Endpoint: POST /auth/sign-up/email
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return api.post<RegisterResponse>('/auth/sign-up/email', data);
  },

  /**
   * Logout user
   * Endpoint: POST /simple-auth/logout
   */
  async logout(): Promise<void> {
    try {
      await api.post('/simple-auth/logout');
    } finally {
      // Always clear token even if API call fails
      clearToken();
    }
  },

  /**
   * Get current session (user + session info)
   * Endpoint: GET /simple-auth/session
   */
  async getSession(): Promise<SessionResponse | null> {
    try {
      const response = await api.get<SessionResponse>('/simple-auth/session');
      return response;
    } catch (error: any) {
      // Session not found or expired
      if (error.status === 401) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Request password reset
   * Endpoint: POST /auth/forgot-password
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> {
    return api.post<ForgotPasswordResponse>('/auth/forgot-password', data);
  },

  /**
   * Reset password with token
   * Endpoint: POST /auth/reset-password
   */
  async resetPassword(data: ResetPasswordRequest): Promise<ResetPasswordResponse> {
    return api.post<ResetPasswordResponse>('/auth/reset-password', data);
  },
};
