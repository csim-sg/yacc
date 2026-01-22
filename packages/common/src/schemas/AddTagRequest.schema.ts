import { z } from 'zod';

export const AddTagRequestSchema = z.object({
  tagId: z.string().uuid(),
});
