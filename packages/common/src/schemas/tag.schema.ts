import { z } from 'zod';

export const TagSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  createdById: z.string().uuid(),
});
