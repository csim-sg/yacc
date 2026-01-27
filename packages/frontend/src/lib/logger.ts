/**
 * Logger Utility
 *
 * Simple logging utility for the frontend
 * Provides consistent logging with context and environment awareness
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig = {
    enabled: true,
    minLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  };

  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, data || '');
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, data || '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, data || '');
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, data || '');
    }
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();
