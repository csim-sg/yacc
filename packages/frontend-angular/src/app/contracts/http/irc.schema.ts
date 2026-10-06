import { z } from 'zod';
import { dataEnvelopeSchema } from '../common/envelope.schema';

/**
 * IRC contract family (T3 §4.2 — live controllers).
 *
 * Two sub-surfaces, one family per T3 §1.2:
 * - `/api/integrations/irc/*` (integration): config/connect/test/status.
 *   Only `POST /test` has a live FE consumer today (W16 test button,
 *   envelope `{ data: { success, message } }`).
 * - `/api/integrations/irc/profiles` (profiles, integer ids — the T3 §4.1
 *   id-exception family): raw (unwrapped) JSON responses, consumed live
 *   by the React `ircProfiles.service` (the third raw-fetch HTTP path the
 *   Angular single-HTTP-entry seam folds in).
 */

/** IRC profile connection config (embedded object). */
export const IrcProfileConfigSchema = z.object({
  server: z.string(),
  port: z.number().int(),
  username: z.string(),
  channels: z.array(z.string()),
});

export type IrcProfileConfig = z.infer<typeof IrcProfileConfigSchema>;

/**
 * Wire IRC profile row — integer `id` (the documented id exception,
 * T3 §4.1), raw response without envelope.
 */
export const IrcProfileSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  isEnabled: z.boolean(),
  isActive: z.boolean(),
  config: IrcProfileConfigSchema,
  hasPassword: z.boolean(),
  lastTestedAt: z.string().optional(),
  lastTestPassed: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type IrcProfile = z.infer<typeof IrcProfileSchema>;

/** GET /api/integrations/irc/profiles — RAW array (no envelope). */
export const ListIrcProfilesResponseSchema = z.array(IrcProfileSchema);

export type ListIrcProfilesResponse = z.infer<typeof ListIrcProfilesResponseSchema>;

/** POST /api/integrations/irc/profiles. */
export const CreateIrcProfileRequestSchema = z.object({
  name: z.string(),
  config: IrcProfileConfigSchema,
  password: z.string().optional(),
});

export type CreateIrcProfileRequest = z.infer<typeof CreateIrcProfileRequestSchema>;

/** PUT /api/integrations/irc/profiles/:id. */
export const UpdateIrcProfileRequestSchema = z.object({
  name: z.string().optional(),
  config: IrcProfileConfigSchema.optional(),
  password: z.string().optional(),
});

export type UpdateIrcProfileRequest = z.infer<typeof UpdateIrcProfileRequestSchema>;

/** POST /api/integrations/irc/profiles/:id/test — raw result (no envelope). */
export const TestConnectionResultSchema = z.object({
  passed: z.boolean(),
  reason: z.string().optional(),
  duration: z.number(),
});

export type TestConnectionResult = z.infer<typeof TestConnectionResultSchema>;

/**
 * POST /api/integrations/irc/test — live W16 consumer; answers
 * `{ data: { success, message } }` (envelope-verified controller).
 */
export const IrcTestRequestSchema = z
  .object({
    server: z.string().optional(),
    port: z.number().int().optional(),
    nick: z.string().optional(),
    channel: z.string().optional(),
  })
  .optional();

export type IrcTestRequest = z.infer<typeof IrcTestRequestSchema>;

export const IrcTestResponseSchema = dataEnvelopeSchema(
  z.object({
    success: z.boolean(),
    message: z.string(),
  })
);

export type IrcTestResponse = z.infer<typeof IrcTestResponseSchema>;

/**
 * GET /api/integrations/irc/status (admin+) — `{ data: status }`;
 * API-only today (no live FE consumer, W16 row).
 */
export const IrcStatusResponseSchema = dataEnvelopeSchema(
  z.object({
    status: z.string(),
    attemptCount: z.number().int(),
  })
);

export type IrcStatusResponse = z.infer<typeof IrcStatusResponseSchema>;

/**
 * POST /api/integrations/irc/config and POST /api/integrations/irc/connect
 * — no live FE consumer today (G8 rows); request bodies are loose maps
 * until a consumer issue pins them.
 */
export const IrcConfigRequestSchema = z.record(z.string(), z.unknown());

export type IrcConfigRequest = z.infer<typeof IrcConfigRequestSchema>;

export const IrcConnectRequestSchema = z.record(z.string(), z.unknown());

export type IrcConnectRequest = z.infer<typeof IrcConnectRequestSchema>;
