/**
 * Collaboration Schemas
 */
import { z } from 'zod';

export const CreateNoteRequestSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const AssignConversationRequestSchema = z.object({
  assignedUserId: z.string().uuid(),
});

export const BulkActionRequestSchema = z.object({
  conversationIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['assign', 'tag', 'changeStatus', 'changePriority']),
  data: z.object({
    assignedUserId: z.string().uuid().optional(),
    tagId: z.string().uuid().optional(),
    status: z.enum(['open', 'pending', 'resolved']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  }),
});
