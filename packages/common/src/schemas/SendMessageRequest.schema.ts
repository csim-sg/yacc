import { z } from 'zod';

export const SendMessageRequestSchema = z.object({
  body: z.string().min(1).max(10000),
  attachmentIds: z.array(z.string().uuid()).optional(),
});
