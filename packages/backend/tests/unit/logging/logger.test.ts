import { describe, expect, beforeEach, afterEach, it, jest } from '@jest/globals';
import pino from 'pino';
import { createChildLogger, logger } from '../../../src/infrastructure/logging/logger.js';

/**
 * Unit tests for Pino logger infrastructure
 * 
 * Coverage Target: 90%+ (BE-027 requirement)
 * 
 * Test Coverage:
 * - Logger configuration (dev vs prod modes)
 * - Child logger creation (correlation ID binding)
 * - Log level filtering (error, warn, info, debug)
 * - Log format validation (JSON structure, ISO timestamps)
 */

describe('Pino Logger', () => {
  let testLogger: pino({ level: 'silent' });

  beforeEach(() => {
    // Reset env vars for tests
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'info';
  });

  afterEach(() => {
    // Clean up env vars after each test
    delete process.env.NODE_ENV;
    delete process.env.LOG_LEVEL;
  });

  describe('Logger Configuration', () => {
    it('should create base logger with default config', () => {
      const baseLogger = pino({
        level: process.env.LOG_LEVEL || 'info',
        formatters: {
          level: (label) => ({ level: label }),
          bindings: (bindings) => ({
            pid: bindings.pid,
            hostname: bindings.hostname,
          }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      });

      expect(typeof baseLogger).toBe('function');
      expect(baseLogger.level).toBe('info');
    });

    it('should use pretty-print in development mode', () => {
      process.env.NODE_ENV = 'development';
      
      const devLogger = pino({
        level: process.env.LOG_LEVEL || 'info',
        formatters: {
          level: (label) => ({ level: label }),
          bindings: (bindings) => ({
            pid: bindings.pid,
            hostname: bindings.hostname,
          }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        ...(!process.env.NODE_ENV && {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }),
      });

      expect(typeof devLogger.transport).toBe('object');
      expect(devLogger.transport.target).toBe('pino-pretty');
    });
  });

  describe('Child Logger Factory', () => {
    it('should create child logger with correlation ID', () => {
      const correlationId = 'test-correlation-123';
      const childLogger = createChildLogger(correlationId);
      
      expect(childLogger).toBeDefined();
      expect(childLogger.bindings.correlationId).toBe(correlationId);
      expect(childLogger.level).toBe(logger.level);
    });

    it('child logger should inherit parent level', () => {
      const childLogger = createChildLogger('test-123');
      expect(childLogger.level).toBe(logger.level);
    });
  });

  describe('Log Output Format', () => {
    it('should output JSON-structured logs in production mode', () => {
      process.env.NODE_ENV = 'production';
      
      const prodLogger = pino({
        level: process.env.LOG_LEVEL || 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
      });

      const logEntry = {
        level: 'info',
        time: 1706140800000,
        pid: 12345,
        hostname: 'test-host',
        msg: 'Test message',
      };

      prodLogger.info('Test message');
      const output = prodLogger.write();
      const lines = output.toString().split('\n');
      
      const logLine = JSON.parse(lines[lines.length - 1]);
      expect(logLine).toHaveProperty('level');
      expect(logLine.level).toBe('info');
      expect(logLine).toHaveProperty('time');
      expect(logLine).toHaveProperty('pid');
      expect(logLine).toHaveProperty('hostname');
      expect(logLine).toHaveProperty('msg');
    });

    it('should include ISO 8601 timestamp', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = pino({
        level: 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
      });

      const logEntry = prodLogger.write(ISOString('2006-01-24T12:34:56.789Z'), 'Test message');
      const parsed = JSON.parse(logEntry);
      expect(parsed.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});

/**
 * Helper to create test logger (suppresses output in tests)
 */
function createTestLogger() {
  return pino({ level: 'silent', });
}
