import { z } from 'zod';
import { baseListResponseSchema } from '../common/envelope.schema';

/**
 * Conversations contract family (T3 §4.2 — live controllers).
 *
 * `GET /api/conversations` answers the `BaseListResponse` wire shape
 * `{ data, page, limit, total }`. The React service type claims
 * `pageSize` instead of `limit` — a DTO-claim drift recorded in
 * `contracts/manifest.md` (wire truth encoded here).
 */

export const ConversationStatusSchema = z.enum(['open', 'pending', 'resolved']);

export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

export const ConversationPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

export type ConversationPriority = z.infer<typeof ConversationPrioritySchema>;

export const ChannelTypeSchema = z.enum([
  'telegram',
  'irc',
  'whatsapp',
  'wechat',
  'meta',
  'x',
  'email',
  'slack',
]);

export type ChannelType = z.infer<typeof ChannelTypeSchema>;

/** Tag projection embedded in conversation rows (string `id`). */
export const ConversationTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

export type ConversationTag = z.infer<typeof ConversationTagSchema>;

export const ParticipantSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['contact', 'agent']),
});

export type Participant = z.infer<typeof ParticipantSchema>;

/** Row of `GET /api/conversations`. */
export const ConversationListItemSchema = z.object({
  id: z.string().uuid(),
  channel: ChannelTypeSchema,
  externalThreadId: z.string(),
  title: z.string().nullable().optional(),
  status: ConversationStatusSchema,
  priority: ConversationPrioritySchema,
  assignedUserId: z.string().nullable().optional(),
  assignedUserName: z.string().nullable().optional(),
  tags: z.array(ConversationTagSchema).optional(),
  participants: z.array(ParticipantSchema).optional(),
  unreadCount: z.number().int().optional(),
  latestMessagePreview: z.string().nullable().optional(),
  latestMessageAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ConversationListItem = z.infer<typeof ConversationListItemSchema>;

/** Row payload of `GET /api/conversations/:id` (`{ data }`). */
export const ConversationDetailSchema = z.object({
  id: z.string().uuid(),
  channel: ChannelTypeSchema,
  externalThreadId: z.string(),
  title: z.string().nullable().optional(),
  status: ConversationStatusSchema,
  priority: ConversationPrioritySchema,
  assignedUserId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(ConversationTagSchema).optional(),
});

export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

/** Query params of `GET /api/conversations`. */
export const ListConversationsParamsSchema = z.object({
  page: z.number().int().optional(),
  limit: z.number().int().optional(),
  channel: ChannelTypeSchema.optional(),
  status: ConversationStatusSchema.optional(),
  priority: ConversationPrioritySchema.optional(),
  assignedUserId: z.string().optional(),
  tagId: z.number().int().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  unread: z.boolean().optional(),
  sortBy: z.enum(['lastActivity', 'created', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type ListConversationsParams = z.infer<typeof ListConversationsParamsSchema>;

/** GET /api/conversations — `BaseListResponse` wire shape. */
export const ListConversationsResponseSchema = baseListResponseSchema(ConversationListItemSchema);

export type ListConversationsResponse = z.infer<typeof ListConversationsResponseSchema>;

/** GET /api/conversations/:id — `{ data }`. */
export const GetConversationResponseSchema = z.object({
  data: ConversationDetailSchema,
});

export type GetConversationResponse = z.infer<typeof GetConversationResponseSchema>;

/**
 * PATCH /api/conversations/:id/status (admin/manager/super_admin).
 * API-only surface today — no live FE consumer (T3 G8/W11); encoded so a
 * future consumer cannot invent a different shape.
 */
export const UpdateConversationStatusRequestSchema = z.object({
  status: ConversationStatusSchema,
});

export type UpdateConversationStatusRequest = z.infer<
  typeof UpdateConversationStatusRequestSchema
>;

export const UpdateConversationResponseSchema = z.object({
  data: ConversationDetailSchema,
});

export type UpdateConversationResponse = z.infer<typeof UpdateConversationResponseSchema>;

/**
 * PATCH /api/conversations/:id/priority (manager+).
 * API-only surface today — no live FE consumer (T3 G8/W12).
 */
export const UpdateConversationPriorityRequestSchema = z.object({
  priority: ConversationPrioritySchema,
});

export type UpdateConversationPriorityRequest = z.infer<
  typeof UpdateConversationPriorityRequestSchema
>;

/**
 * PATCH /api/conversations/:id/assign (admin+) — separate from the live
 * `POST /api/conversations/:conversationId/assign` assignment endpoint
 * (assignments family); API-only today (G8).
 */
export const AssignConversationByIdRequestSchema = z.object({
  assignedUserId: z.string().uuid(),
});

export type AssignConversationByIdRequest = z.infer<
  typeof AssignConversationByIdRequestSchema
>;
