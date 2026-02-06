import { z } from 'zod';

export const CreateNoteRequestSchema = z.object({
  body: z.string().min(1).max(5000),
});
