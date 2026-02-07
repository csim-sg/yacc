/**
 * Vitest Setup File
 * Runs before tests run
 * 
 * Sets up environment variables, mocks, and test utilities
 */

// Import reflect-metadata for decorators (socket-controllers needs this)
import 'reflect-metadata';

import { beforeAll } from 'vitest';

// Setup environment variables for tests
beforeAll(() => {
  // Mock required environment variables
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/yacc_test';
  process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-better-auth-12345';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-12345';
  process.env.CLOUDFLARE_R2_ENDPOINT = 'https://test.r2.cloudflarestorage.com';
  process.env.CLOUDFLARE_R2_ACCESS_KEY = 'test-access-key';
  process.env.CLOUDFLARE_R2_SECRET_KEY = 'test-secret-key';
  process.env.CLOUDFLARE_R2_BUCKET = 'yacc-test';
  process.env.APP_FRONTEND_URL = 'http://localhost:3000';
  process.env.RESET_PASSWORD_URL = 'http://localhost:3000/reset-password';
  process.env.NODE_ENV = 'test';
});

// Suppress console logs during tests (can override with --verbose flag)
if (process.env.DEBUG !== 'true') {
  // Keep console for critical errors/warnings
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  // Only show console output for errors and warnings
  console.log = (...args: any[]) => {
    // Suppress non-critical logs
  };

  console.info = (...args: any[]) => {
    // Suppress info logs
  };

  console.debug = (...args: any[]) => {
    // Suppress debug logs
  };

  // Keep error and warning output
  // console.error and console.warn are not overridden
}
