/**
 * Express Type Augmentations
 * Adds auth properties and validated data to Express Request type globally
 */

import type { Logger } from 'pino';
import type { AuthUser } from './auth.types';
import type { ValidatedData } from '../middleware/validation.middleware';

declare module 'express' {
  interface Request {
    /**
     * Authenticated user (attached by auth middleware)
     */
    user?: AuthUser;

    /**
     * Authenticated session (attached by auth middleware)
     */
    session?: {
      id: string;
      userId: string;
      expiresAt: Date;
    };

    /**
     * Correlation ID for request tracing (attached by correlation-id middleware)
     */
    correlationId?: string;

    /**
     * Pino logger with correlation ID (attached by request-logging middleware)
     */
    logger?: Logger;

    /**
     * Validated request data (attached by validation middleware)
     * Contains validated body, query, and params after @ValidateX decorators
     *
     * @see ValidatedRequest for type-safe access
     */
    validated?: ValidatedData;
  }
}
