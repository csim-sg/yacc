import { z } from 'zod';
import { dataEnvelopeSchema } from '../common/envelope.schema';
import { ConversationDetailSchema } from './conversations.schema';

/**
 * Assignments contract family (T3 §4.2 — live controllers).
 *
 * Live route: `POST /api/conversations/:conversationId/assign` (manager+).
 * Unassign is not supported server-side (`assignedUserId` is required,
 * non-nullable) — no unassign request shape exists (W10 parity).
 */

/** POST /api/conversations/:conversationId/assign — `{ assignedUserId }`. */
export const AssignConversationRequestSchema = z.object({
  assignedUserId: z.string().uuid(),
});

export type AssignConversationRequest = z.infer<typeof AssignConversationRequestSchema>;

/** Assign answer: the updated conversation — `{ data: conversation }`. */
export const AssignConversationResponseSchema = dataEnvelopeSchema(ConversationDetailSchema);

export type AssignConversationResponse = z.infer<typeof AssignConversationResponseSchema>;
