/**
 * Logger (Singleton)
 *
 * Provides structured logging with Pino
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import pino from 'pino';
import type { Logger, LoggerOptions } from 'pino';
import { config } from '../config/config';

/**
 * Configuration
 */
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || config.logging.level;

/**
 * Pino logger configuration
 */
const loggerOptions: LoggerOptions = {
  level: logLevel,
  
  // Development: Pretty-print for human readability
  // Production: JSON logs for machine parsing
  ...(isProduction ? {
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
      }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  } : {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  }),
};

/**
 * Base Pino logger
 *
 * Used as default logger throughout application.
 * For request-scoped logging with correlation ID, use createChildLogger().
 */
export const logger = pino(loggerOptions);

/**
 * Child logger factory
 *
 * Creates a child logger with correlation ID for request tracing.
 *
 * @param correlationId - Unique identifier for request (from middleware)
 * @returns Logger with correlation ID bound to all log entries
 *
 * @example
 * const childLogger = createChildLogger('abc123');
 * childLogger.info({ userId: 123 }, 'User logged in');
 * // Output: { "level": "info", "time": 1706140800, "correlationId": "abc123", "userId": 123, "msg": "User logged in" }
 */
export function createChildLogger(correlationId: string): Logger {
  return logger.child({ correlationId });
}

/**
 * Audit logger for compliance events
 *
 * Dedicated logger for security and compliance events:
 * - User authentication (login, logout, password reset)
 * - Authorization failures (403 Forbidden)
 * - User management actions
 * 
 * All audit logs include "audit": true field for easy filtering.
 *
 * @example
 * auditLogger.warn({ event: 'user.login.failed', userId: '123', reason: 'invalid_credentials' }, 'Login failed');
 * // Output: { "level": "warn", "audit": true, "event": "user.login.failed", "userId": "123", "reason": "invalid_credentials", "msg": "Login failed" }
 */
export const auditLogger = logger.child({ audit: true });
