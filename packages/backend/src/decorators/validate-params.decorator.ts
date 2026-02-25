/**
 * Validate Params Decorator
 *
 * Decorator to validate path parameters with Zod schema.
 * Uses routing-controllers @UseBefore pattern.
 *
 * @see ADR-014 - routing-controllers pattern (no app.use())
 * @see ADR-020 - Zod as source of truth
 */

import { UseBefore } from 'routing-controllers';
import { createValidationMiddleware, ValidationType, type ZodSchemaLike } from '../middleware/validation.middleware';

/**
 * Decorator to validate path parameters with Zod schema
 *
 * Attaches validated data to req.validated.params for type-safe access.
 *
 * @param schema - Zod schema to validate path parameters against
 * @returns MethodDecorator for routing-controllers
 *
 * @example
 * ```typescript
 * @Get('/conversations/:id')
 * @ValidateParams(conversationParamsSchema)
 * async getById(@Req() req: ValidatedRequest<never, never, typeof conversationParamsSchema>) {
 *   const { id } = req.validated.params; // Type-safe!
 *   // ...
 * }
 * ```
 */
export function ValidateParams(schema: ZodSchemaLike): MethodDecorator {
  return UseBefore(createValidationMiddleware(ValidationType.PARAMS, schema)) as MethodDecorator;
}
