/**
 * Validated Request Type
 *
 * Type-safe request interface for use with validation decorators.
 * Provides type inference from Zod schemas for body, query, and params.
 *
 * @see ADR-014 - routing-controllers pattern
 * @see ADR-020 - Zod as source of truth
 */

import type { Request } from 'express';
import type { ValidatedData as ValidationMiddlewareData } from '../middleware/validation.middleware';

/**
 * Generic schema type for type inference (works with both Zod 3 and Zod 4)
 */
type SchemaLike = { _output?: unknown; _input?: unknown };

/**
 * Helper to infer output type from a schema
 */
type InferOutput<T> = T extends { _output: infer O } ? O : T extends { parse: (d: unknown) => infer O } ? O : unknown;

/**
 * Type-safe request interface with validated data
 *
 * @template TBody - Zod schema for body validation (defaults to never)
 * @template TQuery - Zod schema for query validation (defaults to never)
 * @template TParams - Zod schema for params validation (defaults to never)
 *
 * @example
 * ```typescript
 * // With body validation
 * function loginHandler(req: ValidatedRequest<typeof loginSchema>) {
 *   const { email, password } = req.validated.body; // Type-safe!
 * }
 *
 * // With query validation
 * function listHandler(req: ValidatedRequest<never, typeof querySchema>) {
 *   const { page, limit } = req.validated.query; // Type-safe!
 * }
 *
 * // With params validation
 * function getByIdHandler(req: ValidatedRequest<never, never, typeof paramsSchema>) {
 *   const { id } = req.validated.params; // Type-safe!
 * }
 *
 * // Combined validation
 * function updateHandler(
 *   req: ValidatedRequest<typeof updateSchema, never, typeof paramsSchema>
 * ) {
 *   const { id } = req.validated.params;
 *   const { status } = req.validated.body;
 * }
 * ```
 */
export type ValidatedRequest<
  TBody extends SchemaLike = never,
  TQuery extends SchemaLike = never,
  TParams extends SchemaLike = never,
> = Request & {
  validated: {
    body: TBody extends SchemaLike ? InferOutput<TBody> : never;
    query: TQuery extends SchemaLike ? InferOutput<TQuery> : never;
    params: TParams extends SchemaLike ? InferOutput<TParams> : never;
  };
};

/**
 * Helper type to extract body type from ValidatedRequest
 */
export type ValidatedBody<T extends ValidatedRequest> = T['validated']['body'];

/**
 * Helper type to extract query type from ValidatedRequest
 */
export type ValidatedQuery<T extends ValidatedRequest> = T['validated']['query'];

/**
 * Helper type to extract params type from ValidatedRequest
 */
export type ValidatedParams<T extends ValidatedRequest> = T['validated']['params'];

// Re-export ValidatedData for convenience
export type ValidatedData = ValidationMiddlewareData;
