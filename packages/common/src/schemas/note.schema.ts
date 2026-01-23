/**
 * Note Schema
 */
import { z } from 'zod';

export const NoteSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string(),
  body: z.string().min(1).max(5000),
  createdAt: z.string().datetime(),
});
