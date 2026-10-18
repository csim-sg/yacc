/**
 * Logger utility (React `lib/logger.ts` port — T2 §6 / ARCH-005 §6).
 *
 * Consistent, environment-aware console logging with levels. The Vite
 * `import.meta.env.DEV` toggle is replaced by Angular's `isDevMode()`
 * (build-time mechanism, ARCH-005 boundary 6 — no `import.meta.env`
 * anywhere in this package).
 *
 * `SLOMonitor`/`MetricsSink`/`WebSocketLogger` are deliberately NOT ported
 * (parity of absence — the surface is unwired today, T1 F6; wiring them
 * later is a U9-gated decision).
 */
import { isDevMode } from '@angular/core';

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
    minLevel: isDevMode() ? 'debug' : 'info',
  };

  /** Adjust runtime behavior (e.g. silence logging in tests). */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, data ?? '');
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, data ?? '');
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, data ?? '');
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, data ?? '');
    }
  }
}

/** Global logger instance. */
export const logger = new Logger();
