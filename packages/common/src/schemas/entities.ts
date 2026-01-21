import { z } from 'zod';
import {
  ROLES,
  USER_STATUSES,
  CONVERSATION_STATUSES,
  PRIORITY_LEVELS,
  MESSAGE_STATUSES,
  MESSAGE_DIRECTIONS,
} from '../constants';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.nativeEnum(ROLES),
  status: z.nativeEnum(USER_STATUSES),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(['telegram', 'irc']),
  externalThreadId: z.string(),
  status: z.nativeEnum(CONVERSATION_STATUSES),
  priority: z.nativeEnum(PRIORITY_LEVELS),
  assignedUserId: z.string().uuid().optional(),
  lastMessageAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid().optional(),
  senderName: z.string().optional(),
  body: z.string(),
  status: z.nativeEnum(MESSAGE_STATUSES),
  direction: z.nativeEnum(MESSAGE_DIRECTIONS),
  platformMessageId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  url: z.string().url(),
  storageKey: z.string(),
  type: z.string(),
  name: z.string(),
  size: z.number(),
  uploadedById: z.string().uuid().optional(),
  uploadedAt: z.string().datetime(),
});

export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  createdById: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const NoteSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string(),
  body: z.string().min(1).max(5000),
  createdAt: z.string().datetime(),
});
