/**
 * Logger
 *
 * Initializes and provides access to Pino logger
 * Follows ADR-005: Infrastructure folder for client initialization with DI
 */

import pino from 'pino';
import type { Logger, LoggerOptions } from 'pino';
import { config } from '../config/config';

/**
 * Logger class
 * Provides structured logging with Pino
 * Uses DI pattern: accepts config in constructor
 */
export class Logger {
  private logger: Logger;
  private options: LoggerOptions;

  /**
   * Initialize logger with provided config
   */
  constructor(loggerConfig?: Partial<LoggerOptions>) {
    this.options = {
      level: config.logging.level,
      
      // Development: Pretty-print for human readability
      // Production: JSON logs for machine parsing
      ...(config.logging.format === 'pretty' && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      }),
      
      // Structured log format
      formatters: {
        level: (label) => ({ level: label }),
        bindings: (bindings) => ({
          pid: bindings.pid,
          hostname: bindings.hostname,
        }),
      },
      
      // ISO 8601 timestamps
      timestamp: pino.stdTimeFunctions.isoTime,
      
      // Serialize errors properly (prevents log injection)
      serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
      },
      ...loggerConfig,
    };

    this.logger = pino(this.options);
  }

  /**
   * Get logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }

  /**
   * Create child logger with correlation ID for request tracing
   * 
   * @param correlationId - Unique identifier for request (from middleware)
   * @returns Logger with correlation ID bound to all log entries
   * 
   * @example
   * const childLogger = createChildLogger('abc123');
   * childLogger.info({ userId: 123 }, 'User logged in');
   * // Output: { "level": "info", "time": 1706140800, "correlationId": "abc123", "userId": 123, "msg": "User logged in" }
   */
  createChildLogger(correlationId: string): Logger {
    return this.logger.child({ correlationId });
  }

  /**
   * Get audit logger for compliance events
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
  getAuditLogger(): Logger {
    return this.logger.child({ audit: true });
  }
}
