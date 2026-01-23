/**
 * Tag Schema
 */
import { z } from 'zod';

export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  createdById: z.string().uuid(),
  createdAt: z.string().datetime(),
});
