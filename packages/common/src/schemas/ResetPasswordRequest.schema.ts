import { z } from 'zod';

export const ResetPasswordRequestSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(128),
});
