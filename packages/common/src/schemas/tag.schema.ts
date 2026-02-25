/**
 * Tag Schemas
 *
 * Zod schemas for tag entity and request validation.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';

/**
 * Tag entity schema
 * Represents a tag in the database
 */
export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  createdById: z.string().uuid(),
  createdAt: z.coerce.date(),
});

/**
 * Inferred type for tag entity
 */
export type Tag = z.infer<typeof TagSchema>;

/**
 * Create tag request body schema
 * Validates parameters for creating a new tag
 */
export const CreateTagRequestSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50, 'Tag name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (must be #RRGGBB)').optional(),
});

/**
 * Inferred type for create tag request
 */
export type CreateTagRequest = z.infer<typeof CreateTagRequestSchema>;

/**
 * Update tag request body schema
 * Validates parameters for updating a tag
 */
export const UpdateTagRequestSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
});

/**
 * Inferred type for update tag request
 */
export type UpdateTagRequest = z.infer<typeof UpdateTagRequestSchema>;

/**
 * Add tag to conversation request body schema
 */
export const AddTagRequestSchema = z.object({
  tagId: z.string().uuid('Invalid tag ID'),
});

/**
 * Inferred type for add tag request
 */
export type AddTagRequest = z.infer<typeof AddTagRequestSchema>;

/**
 * List tags query parameters schema
 */
export const ListTagsQuerySchema = z.object({
  search: z.string().max(50).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * Inferred type for list tags query
 */
export type ListTagsQuery = z.infer<typeof ListTagsQuerySchema>;
