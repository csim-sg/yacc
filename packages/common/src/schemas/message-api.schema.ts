/**
 * Send Message Schema
 */
import { z } from 'zod';

export const SendMessageRequestSchema = z.object({
  body: z.string().min(1).max(10000),
  attachments: z.array(z.object({
    name: z.string(),
    type: z.string(),
    size: z.number().max(5 * 1024 * 1024),  // 5MB in bytes
    url: z.string().url(),
  })).max(5).optional(),
});
