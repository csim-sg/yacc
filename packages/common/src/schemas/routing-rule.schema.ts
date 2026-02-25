/**
 * Routing Rule Schemas
 *
 * Zod schemas for routing rule entity and request validation.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';
import { RoutingRuleStatusEnum } from '../constants/statuses.constant.js';
import {
  RuleConditionFieldEnum,
  RuleConditionOperatorEnum,
  RuleActionTypeEnum,
} from '../constants/routingRules.constant.js';

/**
 * Rule condition schema
 */
export const RuleConditionSchema = z.object({
  field: RuleConditionFieldEnum,
  operator: RuleConditionOperatorEnum,
  value: z.union([z.string(), z.array(z.string())]),
});

/**
 * Inferred type for rule condition
 */
export type RuleCondition = z.infer<typeof RuleConditionSchema>;

/**
 * Rule action schema
 */
export const RuleActionSchema = z.object({
  type: RuleActionTypeEnum,
  value: z.string(),
});

/**
 * Inferred type for rule action
 */
export type RuleAction = z.infer<typeof RuleActionSchema>;

/**
 * Routing rule entity schema
 */
export const RoutingRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  status: RoutingRuleStatusEnum,
  conditions: z.array(RuleConditionSchema),
  actions: z.array(RuleActionSchema),
  priority: z.number().int().positive(),
  lastRunAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Inferred type for routing rule entity
 */
export type RoutingRule = z.infer<typeof RoutingRuleSchema>;

/**
 * Create routing rule request body schema
 */
export const CreateRoutingRuleRequestSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100, 'Rule name too long'),
  conditions: z.array(RuleConditionSchema).min(1, 'At least one condition is required'),
  actions: z.array(RuleActionSchema).min(1, 'At least one action is required'),
  priority: z.number().int().positive('Priority must be a positive integer'),
});

/**
 * Inferred type for create routing rule request
 */
export type CreateRoutingRuleRequest = z.infer<typeof CreateRoutingRuleRequestSchema>;

/**
 * Update routing rule request body schema
 */
export const UpdateRoutingRuleRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: RoutingRuleStatusEnum.optional(),
  conditions: z.array(RuleConditionSchema).min(1).optional(),
  actions: z.array(RuleActionSchema).min(1).optional(),
  priority: z.number().int().positive().optional(),
});

/**
 * Inferred type for update routing rule request
 */
export type UpdateRoutingRuleRequest = z.infer<typeof UpdateRoutingRuleRequestSchema>;

/**
 * Test routing rule request body schema
 */
export const TestRoutingRuleRequestSchema = z.object({
  conditions: z.array(RuleConditionSchema).min(1, 'At least one condition is required'),
  testConversationId: z.string().uuid('Invalid conversation ID').optional(),
});

/**
 * Inferred type for test routing rule request
 */
export type TestRoutingRuleRequest = z.infer<typeof TestRoutingRuleRequestSchema>;

/**
 * List routing rules query parameters schema
 */
export const ListRoutingRulesQuerySchema = z.object({
  status: RoutingRuleStatusEnum.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * Inferred type for list routing rules query
 */
export type ListRoutingRulesQuery = z.infer<typeof ListRoutingRulesQuerySchema>;
