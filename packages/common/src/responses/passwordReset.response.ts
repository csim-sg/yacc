/**
 * Password Reset Response Types
 * Shared response DTOs for password reset endpoints
 */

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}
