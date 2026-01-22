import { z } from 'zod';

export const RawPayloadSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  storageKey: z.string(),
  contentType: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
