/**
 * Authentication Request Schemas
 *
 * Zod schemas for validating authentication-related requests.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';

/**
 * Login request body schema
 * Validates email and password for authentication
 */
export const LoginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Inferred type for login request
 */
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Forgot password request body schema
 * Validates email for password reset
 */
export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

/**
 * Inferred type for forgot password request
 */
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

/**
 * Reset password request body schema
 * Validates token and new password for password reset
 */
export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Inferred type for reset password request
 */
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
