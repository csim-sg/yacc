/**
 * Validate Query Decorator
 *
 * Decorator to validate query parameters with Zod schema.
 * Uses routing-controllers @UseBefore pattern.
 *
 * @see ADR-014 - routing-controllers pattern (no app.use())
 * @see ADR-020 - Zod as source of truth
 */

import { UseBefore } from 'routing-controllers';
import { createValidationMiddleware, ValidationType, type ZodSchemaLike } from '../middleware/validation.middleware';

/**
 * Decorator to validate query parameters with Zod schema
 *
 * Attaches validated data to req.validated.query for type-safe access.
 *
 * @param schema - Zod schema to validate query parameters against
 * @returns MethodDecorator for routing-controllers
 *
 * @example
 * ```typescript
 * @Get('/conversations')
 * @ValidateQuery(conversationQuerySchema)
 * async list(@Req() req: ValidatedRequest<never, typeof conversationQuerySchema>) {
 *   const { status, assignee_id } = req.validated.query; // Type-safe!
 *   // ...
 * }
 * ```
 */
export function ValidateQuery(schema: ZodSchemaLike): MethodDecorator {
  return UseBefore(createValidationMiddleware(ValidationType.QUERY, schema)) as MethodDecorator;
}
