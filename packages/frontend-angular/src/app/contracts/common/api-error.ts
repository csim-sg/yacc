import type { ErrorEnvelope } from './error.schema';

/**
 * Typed API error surfaced to stores/components (T2 §7).
 *
 * Carries the HTTP status code and the (parsed, permissive) wire error
 * body. 4xx errors surface `message` to the UI; 401 handling (single-flight
 * refresh → replay → clear + /login) is the interceptor layer's concern
 * (ANG-005), not the callers'.
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly body?: ErrorEnvelope | null
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
