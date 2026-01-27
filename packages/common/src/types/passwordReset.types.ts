/**
 * Password Reset Types
 * Types for password reset functionality
 */

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string; // Never expose raw token
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}
