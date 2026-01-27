import { z } from 'zod';

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  url: z.string().url(),
  storageKey: z.string(),
  type: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  uploadedById: z.string().uuid().optional(),
  uploadedAt: z.string().datetime(),
});
