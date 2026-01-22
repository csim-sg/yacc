import { z } from 'zod';
import { MessageStatusEnum, MessageDirectionEnum } from '../constants/statuses.constant';
import { AttachmentSchema } from './Attachment.schema';

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().optional(),
  senderName: z.string().optional(),
  body: z.string(),
  status: MessageStatusEnum,
  direction: MessageDirectionEnum,
  platformMessageId: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
