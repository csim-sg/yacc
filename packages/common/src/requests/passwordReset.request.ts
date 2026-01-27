/**
 * Password Reset Request Types
 * Shared request DTOs for password reset endpoints
 */

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
