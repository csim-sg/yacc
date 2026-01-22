import { z } from 'zod';
import { ChannelEnum, ConversationStatusEnum, PriorityEnum } from '../constants/statuses.constant';
import { TagSchema } from './Tag.schema';
import { ParticipantSchema } from './Participant.schema';

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  channel: ChannelEnum,
  externalThreadId: z.string(),
  status: ConversationStatusEnum,
  priority: PriorityEnum,
  assignedUserId: z.string().uuid().optional(),
  tags: z.array(TagSchema).optional(),
  participants: z.array(ParticipantSchema).optional(),
  lastMessageAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
