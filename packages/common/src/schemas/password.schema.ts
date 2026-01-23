/**
 * Password Reset Schema
 */
import { z } from 'zod';

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(128),
});
