/**
 * Vitest Setup File
 * Runs before tests run
 * 
 * Sets up environment variables, mocks, and test utilities
 */

// Import reflect-metadata for decorators (socket-controllers needs this)
import 'reflect-metadata';

// Setup environment variables IMMEDIATELY (before modules are imported)
// This is needed because config modules load at import time, not at test time
process.env.DATABASE_URL = 'postgresql://yacc_user:yacc_password@localhost:5432/yacc_inbox';
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-better-auth-12345';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-12345';
process.env.CLOUDFLARE_R2_ENDPOINT = 'https://test.r2.cloudflarestorage.com';
process.env.CLOUDFLARE_R2_ACCESS_KEY = 'test-access-key';
process.env.CLOUDFLARE_R2_SECRET_KEY = 'test-secret-key';
process.env.CLOUDFLARE_R2_BUCKET = 'yacc-test';
process.env.APP_FRONTEND_URL = 'http://localhost:3000';
process.env.RESET_PASSWORD_URL = 'http://localhost:3000/reset-password';
process.env.NODE_ENV = 'test';

// Optional: Suppress console logs during tests (opt-in via SUPPRESS_LOGS=true)
if (process.env.SUPPRESS_LOGS === 'true') {
  // Only suppress non-critical logs when explicitly requested
  const noop = () => {
    // No-op function
  };

  // eslint-disable-next-line no-console
  console.log = noop;
  // eslint-disable-next-line no-console
  console.info = noop;
  // eslint-disable-next-line no-console
  console.debug = noop;

  // Keep error and warning output always visible
  // console.error and console.warn are intentionally not overridden
}
