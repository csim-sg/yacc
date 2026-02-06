import { Request, Response, NextFunction } from 'express';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { logger } from '../infrastructure/logger';
import type { AuthUser } from '../types/auth.types';
import type { Logger } from 'pino';

/**
 * Extended Request interface with correlation ID and logger
 */
interface CorrelationRequest extends Request {
  correlationId?: string;
  logger?: Logger;
  user?: AuthUser;
  session?: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
}

/**
 * Async context for correlation ID
 *
 * Stores correlation ID and request-scoped logger in async context
 * Ensures correlation ID propagates across service layers automatically.
 */
export const asyncLocalStorage = new AsyncLocalStorage<{
  correlationId: string;
  logger: Logger;
}>();

// Create base logger instance
const baseLogger = logger;

/**
 * Correlation ID middleware
 *
 * Extracts or generates a correlation ID for request tracing.
 * Attaches a child logger (with correlation ID) to the request.
 * Sets X-Correlation-ID header in response.
 *
 * @order MUST be first middleware in chain
 *
 * @example
 * // In index.ts:
 * app.use(correlationIdMiddleware);   // FIRST - inject correlation ID
 * app.use(requestLoggingMiddleware);  // SECOND - log HTTP requests
 *
 * @returns Express middleware function
 */
export function correlationIdMiddleware(
  req: CorrelationRequest,
  res: Response,
  next: NextFunction
): void {
  // Extract correlation ID from header or generate new
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    randomUUID();

   // Set response header for tracing
   res.setHeader('X-Correlation-ID', correlationId);

    // Create child logger with correlation ID
    const childLogger = baseLogger.child({ correlationId });

   // Attach to request object
   req.correlationId = correlationId;
   req.logger = childLogger;

  // Store in async context (for service layer logging)
  asyncLocalStorage.run({ correlationId, logger: childLogger }, () => {
    next();
  });
}

/**
 * Get current correlation ID from async context
 * 
 * Used in service layer to access correlation ID without passing through function parameters.
 * 
 * @returns correlationId or undefined if not in request context
 * 
 * @example
 * const correlationId = getCorrelationId();
 * if (correlationId) {
 *   logger.info({ userId: 123 }, 'User fetched');
 * }
 * // Output: { "level": "info", "correlationId": "abc123", "userId": 123, "msg": "User fetched" }
 */
export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

/**
 * Get current logger from async context
 * 
 * Returns the logger with correlation ID bound to current async context.
 * Falls back to base logger if not in request context.
 * 
 * @returns Logger with correlation ID or base logger
 * 
 * @example
 * const contextLogger = getLogger();
 * contextLogger.info({ action: 'create_user' }, 'User created');
 * // Output: { "level": "info", "correlationId": "abc123", "action": "create_user", "msg": "User created" }
 */
export function getLogger(): Logger {
  return asyncLocalStorage.getStore()?.logger || baseLogger;
}
