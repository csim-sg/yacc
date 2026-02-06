import { z } from 'zod';

export const AssignConversationRequestSchema = z.object({
  assignedUserId: z.string().uuid(),
});
