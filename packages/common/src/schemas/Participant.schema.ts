import { z } from 'zod';

export const ParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});
