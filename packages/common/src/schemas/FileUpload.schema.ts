import { z } from 'zod';

export const FileUploadSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number().int().nonnegative(),
  url: z.string().url(),
});
