import { z } from 'zod';

/**
 * Wire error envelopes (T3 §4.1 + verified live controllers).
 *
 * TWO error shapes exist on the wire today — both encoded 1:1:
 * - `{ code, message, details? }` — documented error middleware shape
 *   (used e.g. by the IRC integration controller's typed errors).
 * - `{ error: string }` — the shape actually returned by most controllers
 *   on 4xx/5xx paths (`res.status(...).json({ error: ... })`) and the
 *   frozen auth `ErrorResponse`.
 */
export const ErrorEnvelopeSchema = z.union([
  z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    error: z.string(),
  }),
]);

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;
