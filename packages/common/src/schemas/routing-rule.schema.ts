/**
 * Routing Rule Schemas
 */
import { z } from 'zod';

export const CreateRoutingRuleRequestSchema = z.object({
  name: z.string().min(1).max(100),
  conditions: z.array(z.object({
    field: z.enum(['channel', 'keyword', 'sender', 'tag', 'time']),
    operator: z.enum(['eq', 'in', 'contains', 'matches', 'gt', 'lt']),
    value: z.union([z.string(), z.array(z.string())]),
  })),
  actions: z.array(z.object({
    type: z.enum(['assign', 'tag', 'priority']),
    value: z.string(),
  })),
  priority: z.coerce.number().int().positive(),
});

export const UpdateRoutingRuleRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  conditions: z.array(z.object({
    field: z.enum(['channel', 'keyword', 'sender', 'tag', 'time']),
    operator: z.enum(['eq', 'in', 'contains', 'matches', 'gt', 'lt']),
    value: z.union([z.string(), z.array(z.string())]),
  })).optional(),
  actions: z.array(z.object({
    type: z.enum(['assign', 'tag', 'priority']),
    value: z.string(),
  })).optional(),
  priority: z.coerce.number().int().positive().optional(),
});
