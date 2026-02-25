/**
 * Attachment Schemas
 *
 * Zod schemas for attachment entity and request validation.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';

/**
 * Attachment entity schema
 */
export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  url: z.string().url(),
  storageKey: z.string(),
  type: z.string(),
  name: z.string(),
  size: z.number().int().nonnegative(),
  uploadedById: z.string().uuid().optional(),
  uploadedAt: z.coerce.date(),
});

/**
 * Inferred type for attachment entity
 */
export type Attachment = z.infer<typeof AttachmentSchema>;

/**
 * Upload attachment request body schema
 * Metadata for file upload (actual file handled by multipart)
 */
export const UploadAttachmentRequestSchema = z.object({
  messageId: z.string().uuid('Invalid message ID').optional(),
});

/**
 * Inferred type for upload attachment request
 */
export type UploadAttachmentRequest = z.infer<typeof UploadAttachmentRequestSchema>;

/**
 * List attachments query parameters schema
 */
export const ListAttachmentsQuerySchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * Inferred type for list attachments query
 */
export type ListAttachmentsQuery = z.infer<typeof ListAttachmentsQuerySchema>;
