import { z } from 'zod';

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});
