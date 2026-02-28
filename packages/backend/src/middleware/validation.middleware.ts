/**
 * Validation Middleware
 *
 * Creates middleware for Zod schema validation in routing-controllers.
 * Validates request body, query parameters, or path parameters.
 *
 * @see ADR-014 - routing-controllers pattern (no app.use())
 * @see ADR-020 - Zod as source of truth
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { HttpError } from 'routing-controllers';
import { logger } from '../infrastructure/logger';

/**
 * Generic schema type that works with both Zod 3 and Zod 4
 * Only requires the methods we actually use
 */
export type ZodSchemaLike = {
  parseAsync: (data: unknown) => Promise<unknown>;
};

/**
 * Validation target types
 */
export enum ValidationType {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params',
}

/**
 * Formatted validation error detail
 */
export type ValidationErrorDetail = {
  field: string;
  message: string;
  code: string;
};

/**
 * Validation error response structure
 */
export type ValidationErrorResponse = {
  error: string;
  details: ValidationErrorDetail[];
};

/**
 * Extended request with validated data
 * Stores validated body, query, and params after middleware processing
 */
export type ValidatedData = {
  body?: unknown;
  query?: unknown;
  params?: unknown;
};

/**
 * Formats Zod errors into standardized error response
 *
 * @param zodError - The ZodError from validation failure
 * @returns Formatted error response with field-level details
 */
function formatZodErrors(zodError: ZodError): ValidationErrorResponse {
  // Zod 4 uses 'issues' instead of 'errors'
  const issues = zodError.issues;

  const formattedErrors: ValidationErrorDetail[] = issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));

  return {
    error: 'Validation failed',
    details: formattedErrors,
  };
}

/**
 * Validation middleware factory
 * Creates middleware for each validation type (body, query, params)
 *
 * @param type - The validation target (body, query, or params)
 * @param schema - The Zod schema to validate against
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * // In decorator
 * export function ValidateBody(schema: ZodSchemaLike): MethodDecorator {
 *   return UseBefore(createValidationMiddleware(ValidationType.BODY, schema));
 * }
 * ```
 */
export function createValidationMiddleware(type: ValidationType, schema: ZodSchemaLike) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const correlationId = req.correlationId || 'unknown';

    try {
      // Get data source based on validation type
      const dataSource = req[type];

      // Validate with Zod schema (async for refine transforms)
      const validatedData = await schema.parseAsync(dataSource);

      // Attach validated data to request (using type assertion for Express augmentation)
      const validatedReq = req as Request & { validated: ValidatedData };
      if (!validatedReq.validated) {
        validatedReq.validated = {};
      }
      validatedReq.validated[type] = validatedData;

      logger.debug(
        { correlationId, validationType: type, fields: Object.keys(validatedData || {}) },
        'Request validation passed'
      );

      next();
    } catch (error) {
      // Check if error is a ZodError
      if (error instanceof ZodError) {
        // Format Zod errors into standardized response
        const errorResponse = formatZodErrors(error);

        logger.warn(
          { correlationId, validationType: type, validationErrors: errorResponse.details },
          'Request validation failed'
        );

        // Return 400 Bad Request with field-level errors
        return next(new HttpError(400, JSON.stringify(errorResponse)));
      }

      // Pass other errors to global error handler
      logger.error(
        { correlationId, validationType: type, error: error instanceof Error ? error.message : String(error) },
        'Unexpected validation error'
      );
      next(error);
    }
  };
}
