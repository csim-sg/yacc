import { z } from 'zod';
import { baseListResponseSchema, dataEnvelopeSchema } from '../common/envelope.schema';

/**
 * Notes contract family (T3 §4.2 — live controllers).
 *
 * `GET /api/conversations/:conversationId/notes` uses `pageSize` as its
 * REQUEST query param (controller-verified) but answers the standard
 * `BaseListResponse` wire shape `{ data, page, limit, total }` — the React
 * service type claims `pageSize` in the RESPONSE too (drift row recorded
 * in `contracts/manifest.md`).
 */

/** Wire note row. */
export const NoteSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  authorId: z.string().uuid(),
  body: z.string(),
  mentions: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Note = z.infer<typeof NoteSchema>;

/** GET /api/conversations/:conversationId/notes?page&pageSize — query params. */
export const ListNotesParamsSchema = z.object({
  page: z.number().int().optional(),
  pageSize: z.number().int().optional(),
});

export type ListNotesParams = z.infer<typeof ListNotesParamsSchema>;

/** GET response — `BaseListResponse` wire shape (see drift note above). */
export const ListNotesResponseSchema = baseListResponseSchema(NoteSchema);

export type ListNotesResponse = z.infer<typeof ListNotesResponseSchema>;

/** POST /api/conversations/:conversationId/notes — `{ body }` (mentions parsed server-side). */
export const CreateNoteRequestSchema = z.object({
  body: z.string(),
});

export type CreateNoteRequest = z.infer<typeof CreateNoteRequestSchema>;

export const CreateNoteResponseSchema = dataEnvelopeSchema(NoteSchema);

export type CreateNoteResponse = z.infer<typeof CreateNoteResponseSchema>;
