import { z } from 'zod';

export const MessageStatusSchema = z.enum(['pending', 'sent', 'failed']);

export const MessageDirectionSchema = z.enum(['inbound', 'outbound']);

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  name: z.string(),
  type: z.string(),
  size: z.number().max(5242880, 'Attachment size must not exceed 5MB'),
  storageKey: z.string().optional(),
});

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  body: z.string().min(1, 'Message body cannot be empty'),
  status: MessageStatusSchema,
  direction: MessageDirectionSchema,
  attachments: z.array(AttachmentSchema).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateMessageSchema = z.object({
  body: z.string().min(1, 'Message body cannot be empty').max(5000),
  attachments: z.array(z.string().url()).optional(),
});

export type Message = z.infer<typeof MessageSchema>;
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
