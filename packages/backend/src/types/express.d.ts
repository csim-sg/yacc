/**
 * Express Type Augmentations
 * Adds auth properties to Express Request type globally
 */

import type { Logger } from 'pino';
import type { AuthUser } from './auth.types';

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
  }
}
