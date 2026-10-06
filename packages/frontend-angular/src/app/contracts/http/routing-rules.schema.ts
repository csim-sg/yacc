import { z } from 'zod';
import { baseListResponseSchema, dataEnvelopeSchema } from '../common/envelope.schema';

/**
 * Routing-rules contract family (T3 §4.2 — live controllers).
 *
 * - The plain list (`GET /api/routing-rules`) answers `BaseListResponse`
 *   `{ data, page, limit, total }` (page 1, limit = total — no pagination
 *   for rules); the React service type claims `{ data }` only. The `.data`
 *   field both ways is compatible; the full wire shape is encoded here.
 * - Executions pagination uses `pageSize` (NOT `limit`) as the request
 *   param (controller-verified).
 */

export const RoutingRuleConditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.unknown(),
});

export type RoutingRuleCondition = z.infer<typeof RoutingRuleConditionSchema>;

export const RoutingRuleActionSchema = z.object({
  type: z.string(),
  value: z.unknown(),
});

export type RoutingRuleAction = z.infer<typeof RoutingRuleActionSchema>;

/** Wire routing-rule row. */
export const RoutingRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(['active', 'disabled']),
  priority: z.number().int(),
  conditions: z.array(RoutingRuleConditionSchema),
  actions: z.array(RoutingRuleActionSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RoutingRule = z.infer<typeof RoutingRuleSchema>;

/** GET /api/routing-rules — `BaseListResponse` wire shape. */
export const ListRoutingRulesResponseSchema = baseListResponseSchema(RoutingRuleSchema);

export type ListRoutingRulesResponse = z.infer<typeof ListRoutingRulesResponseSchema>;

/** GET /api/routing-rules/:id — `{ data: rule }`. */
export const GetRoutingRuleResponseSchema = dataEnvelopeSchema(RoutingRuleSchema);

export type GetRoutingRuleResponse = z.infer<typeof GetRoutingRuleResponseSchema>;

/** POST /api/routing-rules (admin+). */
export const CreateRoutingRuleRequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  priority: z.number().int(),
  conditions: z.array(RoutingRuleConditionSchema),
  actions: z.array(RoutingRuleActionSchema),
});

export type CreateRoutingRuleRequest = z.infer<typeof CreateRoutingRuleRequestSchema>;

export const CreateRoutingRuleResponseSchema = dataEnvelopeSchema(RoutingRuleSchema);

export type CreateRoutingRuleResponse = z.infer<typeof CreateRoutingRuleResponseSchema>;

/** PATCH /api/routing-rules/:id (admin+ — NOT PUT). */
export const UpdateRoutingRuleRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  status: z.enum(['active', 'disabled']).optional(),
  conditions: z.array(RoutingRuleConditionSchema).optional(),
  actions: z.array(RoutingRuleActionSchema).optional(),
});

export type UpdateRoutingRuleRequest = z.infer<typeof UpdateRoutingRuleRequestSchema>;

export const UpdateRoutingRuleResponseSchema = dataEnvelopeSchema(RoutingRuleSchema);

export type UpdateRoutingRuleResponse = z.infer<typeof UpdateRoutingRuleResponseSchema>;

/** DELETE /api/routing-rules/:id (admin+) — `{ data: <deleted-rule result> }`. */
export const DeleteRoutingRuleResponseSchema = dataEnvelopeSchema(z.unknown());

export type DeleteRoutingRuleResponse = z.infer<typeof DeleteRoutingRuleResponseSchema>;

/** GET /api/routing-rules/:id/executions?page&pageSize — request params. */
export const ListRoutingRuleExecutionsParamsSchema = z.object({
  page: z.number().int().optional(),
  pageSize: z.number().int().optional(),
});

export type ListRoutingRuleExecutionsParams = z.infer<
  typeof ListRoutingRuleExecutionsParamsSchema
>;

/** Wire routing-rule execution row. */
export const RoutingRuleExecutionSchema = z.object({
  id: z.string().uuid(),
  ruleId: z.string().uuid(),
  conversationId: z.string().uuid(),
  matchedConditions: z.array(RoutingRuleConditionSchema),
  appliedActions: z.array(RoutingRuleActionSchema),
  createdAt: z.string(),
});

export type RoutingRuleExecution = z.infer<typeof RoutingRuleExecutionSchema>;

/** GET executions — `BaseListResponse` wire shape. */
export const ListRoutingRuleExecutionsResponseSchema = baseListResponseSchema(
  RoutingRuleExecutionSchema
);

export type ListRoutingRuleExecutionsResponse = z.infer<
  typeof ListRoutingRuleExecutionsResponseSchema
>;
