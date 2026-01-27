/**
 * Password Reset Validation Schemas
 * Zod schemas for password reset endpoints
 */

import { z } from 'zod';

// Import password requirements from auth schema
export const PASSWORD_SCHEMA = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

/**
 * Forgot Password Request Schema
 * Validates email format and normalizes to lowercase
 */
export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').trim().toLowerCase(),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

/**
 * Reset Password Request Schema
 * Validates token format (64-char hex) and password requirements
 */
export const ResetPasswordSchema = z.object({
  token: z
    .string()
    .length(64, 'Invalid token format')
    .regex(/^[a-f0-9]{64}$/, 'Invalid token format'),
  newPassword: PASSWORD_SCHEMA,
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
