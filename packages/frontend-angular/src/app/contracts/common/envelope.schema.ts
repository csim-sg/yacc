import { z } from 'zod';

/**
 * Wire response envelopes (T3 §4.1).
 *
 * Single-resource responses are wrapped as `{ data: ... }`. List responses
 * use the backend `BaseListResponse` shape `{ data, page, limit, total }`
 * (1-indexed `page`) — encoded as a local shape, never imported from the
 * YACC common package (SPEC binding decision; ADR-020 idiom only).
 *
 * Known list-shape drift rows recorded in `contracts/manifest.md`: the
 * React services type some lists as `{ page, pageSize, ... }` or
 * `{ items, pages }` — the wire (live controllers) is `limit`, and these
 * schemas encode the wire, not the React type claims.
 */

/** Wrap a payload schema in the single-resource success envelope. */
export function dataEnvelopeSchema<T extends z.ZodTypeAny>(payload: T) {
  return z.object({ data: payload });
}

/** Wrap an item schema in the list response envelope (`BaseListResponse`). */
export function baseListResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
  });
}
