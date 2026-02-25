/**
 * Integration Schemas
 *
 * Zod schemas for integration entity and request validation.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';
import { ChannelEnum } from '../constants/statuses.constant.js';
import { RoutingRuleStatusEnum } from '../constants/statuses.constant.js';

/**
 * Integration entity schema
 */
export const IntegrationSchema = z.object({
  id: z.string().uuid(),
  platform: ChannelEnum,
  name: z.string().min(1).max(100),
  status: RoutingRuleStatusEnum,
  config: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Inferred type for integration entity
 */
export type Integration = z.infer<typeof IntegrationSchema>;

/**
 * Create integration request body schema
 */
export const CreateIntegrationRequestSchema = z.object({
  platform: ChannelEnum,
  name: z.string().min(1, 'Integration name is required').max(100, 'Integration name too long'),
  config: z.record(z.unknown()).optional(),
});

/**
 * Inferred type for create integration request
 */
export type CreateIntegrationRequest = z.infer<typeof CreateIntegrationRequestSchema>;

/**
 * Update integration request body schema
 */
export const UpdateIntegrationRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: RoutingRuleStatusEnum.optional(),
  config: z.record(z.unknown()).optional(),
});

/**
 * Inferred type for update integration request
 */
export type UpdateIntegrationRequest = z.infer<typeof UpdateIntegrationRequestSchema>;

/**
 * Test connection request body schema
 */
export const TestConnectionRequestSchema = z.object({
  platform: ChannelEnum,
  config: z.record(z.unknown()),
});

/**
 * Inferred type for test connection request
 */
export type TestConnectionRequest = z.infer<typeof TestConnectionRequestSchema>;

/**
 * List integrations query parameters schema
 */
export const ListIntegrationsQuerySchema = z.object({
  platform: ChannelEnum.optional(),
  status: RoutingRuleStatusEnum.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * Inferred type for list integrations query
 */
export type ListIntegrationsQuery = z.infer<typeof ListIntegrationsQuerySchema>;
