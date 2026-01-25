/**
 * Global Setup for Vitest
 * Runs once before all test suites
 * 
 * Using ESM format for Vitest
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setup(): Promise<void> {
  // Load test environment variables from .env.test
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error'; // Minimize logs during tests (error level is most restrictive)

  // Optional: Set up test database connection pool limits
  process.env.DB_POOL_MIN = '1';
  process.env.DB_POOL_MAX = '2';

  console.log('🧪 Vitest global setup complete');
}
