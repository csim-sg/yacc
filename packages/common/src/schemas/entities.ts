import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['super_admin', 'admin', 'manager', 'user']),
  status: z.enum(['active', 'disabled']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(['telegram', 'irc']),
  externalThreadId: z.string(),
  status: z.enum(['open', 'pending', 'resolved']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
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
  status: z.enum(['pending', 'sent', 'failed']),
  direction: z.enum(['inbound', 'outbound']),
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
