import { z } from 'zod';
import {
  ROLES,
  USER_STATUSES,
  CONVERSATION_STATUSES,
  PRIORITY_LEVELS,
  MESSAGE_STATUSES,
  MESSAGE_DIRECTIONS,
} from '../constants';

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8).max(128),
});

export const GetConversationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  channel: z.enum(['telegram', 'irc']).optional(),
  assignedUserId: z.string().uuid().optional(),
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  tagId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const UpdateConversationRequestSchema = z.object({
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedUserId: z.string().uuid().optional(),
});

export const SendMessageRequestSchema = z.object({
  body: z.string().min(1).max(10000),
  attachments: z.array(z.object({
    name: z.string(),
    type: z.string(),
    size: z.number().max(5 * 1024 * 1024),  // 5MB in bytes
    url: z.string().url(),
  })).max(5).optional(),
});

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

export const CreateRoutingRuleRequestSchema = z.object({
  name: z.string().min(1).max(100),
  conditions: z.array(z.object({
    field: z.enum(['channel', 'keyword', 'sender', 'tag', 'time']),
    operator: z.enum(['eq', 'in', 'contains', 'matches', 'gt', 'lt']),
    value: z.union([z.string(), z.array(z.string())]),
  })),
  actions: z.array(z.object({
    type: z.enum(['assign', 'tag', 'priority']),
    value: z.string(),
  })),
  priority: z.coerce.number().int().positive(),
});

export const SearchConversationsQuerySchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  channel: z.enum(['telegram', 'irc']).optional(),
  tagId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
