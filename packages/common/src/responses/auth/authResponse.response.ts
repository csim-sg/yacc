/**
 * Auth Response Types
 * Response shapes for auth endpoints
 */
export interface AuthResponse {
  success: boolean;
  message: string;
}

export interface ForgotPasswordResponse {
  message: string;
  success?: boolean;
}

export interface ResetPasswordResponse {
  message: string;
  success?: boolean;
}
