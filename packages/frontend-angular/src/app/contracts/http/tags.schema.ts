import { z } from 'zod';
import { dataEnvelopeSchema } from '../common/envelope.schema';

/**
 * Tags contract family (T3 §4.2 — live controllers).
 *
 * Wire irregularity encoded 1:1 (see `contracts/manifest.md`): the wire
 * attach/detach routes are `POST /api/conversations/:id/tags` and
 * `DELETE /api/conversations/:id/tags/:tagId`. The React service calls
 * `/api/tags/conversations/:id[...]` instead — those routes do not exist
 * server-side (recorded drift row, not silently reproduced).
 */

/** Wire tag row (`tags` table — integer id, unlike conversation tag projections). */
export const TagSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string(),
  createdAt: z.string(),
  createdBy: z.string(),
});

export type Tag = z.infer<typeof TagSchema>;

/** GET /api/tags — `{ data: Tag[] }`. */
export const ListTagsResponseSchema = dataEnvelopeSchema(z.array(TagSchema));

export type ListTagsResponse = z.infer<typeof ListTagsResponseSchema>;

/** POST /api/tags — `{ name, color }` → `{ data: Tag }`. */
export const CreateTagRequestSchema = z.object({
  name: z.string(),
  color: z.string(),
});

export type CreateTagRequest = z.infer<typeof CreateTagRequestSchema>;

export const CreateTagResponseSchema = dataEnvelopeSchema(TagSchema);

export type CreateTagResponse = z.infer<typeof CreateTagResponseSchema>;

/** POST /api/conversations/:id/tags — `{ tagId }` → `{ data: { tags } }`. */
export const AttachTagRequestSchema = z.object({
  tagId: z.number().int(),
});

export type AttachTagRequest = z.infer<typeof AttachTagRequestSchema>;

/** Attach/detach answer: updated conversation tag list. */
export const ConversationTagsResponseSchema = dataEnvelopeSchema(
  z.object({ tags: z.array(TagSchema) })
);

export type ConversationTagsResponse = z.infer<typeof ConversationTagsResponseSchema>;
