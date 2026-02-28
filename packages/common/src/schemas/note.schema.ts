/**
 * Note Schemas
 *
 * Zod schemas for note entity and request validation.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';

/**
 * Note entity schema
 * Represents an internal note in the database
 */
export const NoteSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  authorId: z.string().uuid(),
  authorName: z.string(),
  body: z.string().min(1).max(5000),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Inferred type for note entity
 */
export type Note = z.infer<typeof NoteSchema>;

/**
 * Create note request body schema
 * Validates parameters for creating a new internal note
 */
export const CreateNoteRequestSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  body: z.string().min(1, 'Note body is required').max(5000, 'Note body too long'),
});

/**
 * Inferred type for create note request
 */
export type CreateNoteRequest = z.infer<typeof CreateNoteRequestSchema>;

/**
 * Update note request body schema
 * Validates parameters for updating a note
 */
export const UpdateNoteRequestSchema = z.object({
  body: z.string().min(1, 'Note body is required').max(5000, 'Note body too long'),
});

/**
 * Inferred type for update note request
 */
export type UpdateNoteRequest = z.infer<typeof UpdateNoteRequestSchema>;

/**
 * List notes query parameters schema
 */
export const ListNotesQuerySchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * Inferred type for list notes query
 */
export type ListNotesQuery = z.infer<typeof ListNotesQuerySchema>;
