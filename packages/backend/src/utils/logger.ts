/**
 * Logger Utility
 *
 * Simple Winston-based logger for application logging
 */

import winston from 'winston';

// ============================================
// Log Levels
// ============================================

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// ============================================
// Logger Configuration
// ============================================

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(
      ({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}`;
      }
    )
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message }) => {
            return `${timestamp} [${level}]: ${message}`;
          }
        )
      ),
    }),
    // File transport for production logs
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/app.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.printf(
                ({ timestamp, level, message }) => {
                  return `${timestamp} [${level}]: ${message}`;
                }
              )
            ),
          }),
        ]
      : []),
  ],
});

// ============================================
// Export
// ============================================

export default logger;
