/**
 * Validate Body Decorator
 *
 * Decorator to validate request body with Zod schema.
 * Uses routing-controllers @UseBefore pattern.
 *
 * @see ADR-014 - routing-controllers pattern (no app.use())
 * @see ADR-020 - Zod as source of truth
 */

import { UseBefore } from 'routing-controllers';
import { createValidationMiddleware, ValidationType, type ZodSchemaLike } from '../middleware/validation.middleware';

/**
 * Decorator to validate request body with Zod schema
 *
 * Attaches validated data to req.validated.body for type-safe access.
 *
 * @param schema - Zod schema to validate request body against
 * @returns MethodDecorator for routing-controllers
 *
 * @example
 * ```typescript
 * @Post('/login')
 * @ValidateBody(loginSchema)
 * async login(@Req() req: ValidatedRequest<typeof loginSchema>) {
 *   const { email, password } = req.validated.body; // Type-safe!
 *   // ...
 * }
 * ```
 */
export function ValidateBody(schema: ZodSchemaLike): MethodDecorator {
  return UseBefore(createValidationMiddleware(ValidationType.BODY, schema)) as MethodDecorator;
}
