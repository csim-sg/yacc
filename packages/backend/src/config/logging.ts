import pino from 'pino';
import type { Logger, LoggerOptions } from 'pino';

/**
 * Environment-based configuration
 */
const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

/**
 * Pino logger configuration
 * 
 * Environment-based:
 * - Development: Pretty-print logs (human-readable)
 * - Production: JSON logs (machine-parsable)
 * 
 * Structured format:
 * - ISO 8601 timestamps
 * - Custom serializers for errors, requests, responses
 * - Correlation ID support via child loggers
 */
const loggerOptions: LoggerOptions = {
  level: logLevel,
  
  // Development: Pretty-print for human readability
  // Production: JSON logs for machine parsing
  ...(!isProduction && {
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
};

/**
 * Base Pino logger
 * 
 * Used as default logger throughout application.
 * 
 * For request-scoped logging with correlation ID, use createChildLogger().
 */
export const logger: Logger = pino(loggerOptions);

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
export const auditLogger: Logger = logger.child({ audit: true });

/**
 * Request metadata serializer
 * 
 * Excludes sensitive headers and body from logs
 * Prevents log injection attacks via structured headers
 */
function serializeRequest(req: any) {
  return {
    id: req.id,
    method: req.method,
    url: req.url,
    query: req.query,
    params: req.params,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
    },
    remoteAddress: req.remoteAddress,
    remotePort: req.remotePort,
  };
}

/**
 * Response metadata serializer
 * 
 * Excludes sensitive response body (if any)
 */
function serializeResponse(res: any) {
  return {
    statusCode: res.statusCode,
    headers: {
      'content-type': res.getHeader('content-type'),
      'content-length': res.getHeader('content-length'),
    },
  };
}
