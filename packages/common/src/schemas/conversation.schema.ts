import { z } from 'zod';

export const ChannelTypeSchema = z.enum(['telegram', 'irc', 'whatsapp', 'twitter']);

export const ConversationStatusSchema = z.enum(['open', 'pending', 'resolved']);

export const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  channel: ChannelTypeSchema,
  externalThreadId: z.string(),
  status: ConversationStatusSchema,
  priority: PrioritySchema,
  assignedUserId: z.string().uuid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const UpdateConversationSchema = z.object({
  status: ConversationStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  assignedUserId: z.string().uuid().optional(),
});

export const ConversationFilterSchema = z.object({
  channel: ChannelTypeSchema.optional(),
  status: ConversationStatusSchema.optional(),
  assignedUserId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.string().optional(),
  searchText: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

export type Conversation = z.infer<typeof ConversationSchema>;
export type UpdateConversation = z.infer<typeof UpdateConversationSchema>;
export type ConversationFilter = z.infer<typeof ConversationFilterSchema>;
