/**
 * Vitest Global Setup File
 * Runs once before all tests in the suite
 *
 * CRITICAL: Environment variables MUST be set here before any modules are imported.
 * These are the SAME values as in tests/setup.ts, ensuring consistency.
 *
 * Responsibilities:
 * 1. Set up environment variables (BEFORE any module evaluation)
 * 2. Verify database connection and schema exists
 * 3. Cleanup after tests
 */

// SET ENVIRONMENT VARIABLES FIRST, BEFORE ANYTHING ELSE
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

import 'reflect-metadata';

/**
 * Global setup function - runs once before all tests
 */
export async function setup() {
  process.stdout.write('\n[SETUP] Preparing test environment...\n\n');

  try {
    // Import database client AFTER env vars are set
    const { dbClient } = await import('../src/infrastructure/db.client.js');

    process.stdout.write('[SETUP] Verifying database connection...\n');

    // Simple test query to verify connection
    const result = await dbClient.execute('SELECT NOW() as now');

    // Safely extract timestamp without using 'any'
    if (result && typeof result === 'object' && 'rows' in result) {
      const rows = result.rows;
      if (Array.isArray(rows) && rows.length > 0) {
        const firstRow = rows[0];
        if (firstRow && typeof firstRow === 'object' && 'now' in firstRow) {
          const timestamp = firstRow.now;
          process.stdout.write(`[SETUP] Database connection successful (${timestamp})\n\n`);
        } else {
          process.stdout.write('[SETUP] Database connection verified\n\n');
        }
      }
    } else {
      process.stdout.write('[SETUP] Database connection verified\n\n');
    }

    // Run migrations to ensure schema is up-to-date
    process.stdout.write('[SETUP] Running migrations...\n');
    try {
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      const { Pool } = await import('pg');

      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });

      const migrationClient = (await import('drizzle-orm/node-postgres')).drizzle(pool);
      await migrate(migrationClient, { migrationsFolder: './drizzle' });

      await pool.end();
      process.stdout.write('[SETUP] Migrations applied\n\n');
    } catch (migrationError: unknown) {
      const migrationMsg = migrationError instanceof Error ? migrationError.message : String(migrationError);
      process.stderr.write(`[SETUP] Migration warning (continuing): ${migrationMsg}\n\n`);
      // Continue even if migrations fail - they may already be applied
    }

    process.stdout.write('[SETUP] Test environment ready\n\n');
  } catch (error: unknown) {
    // Safely handle error without using 'any'
    const errorMessage = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[SETUP] FAILED: ${errorMessage}\n`);
    process.stderr.write('[SETUP] Make sure PostgreSQL is running and migrations have been applied\n');
    throw error;
  }
}

/**
 * Global teardown function - runs once after all tests
 * CRITICAL: All connections must be properly closed or tests will hang
 * Order matters: close queue/worker BEFORE Redis, database last
 */
export async function teardown() {
  process.stdout.write('\n[TEARDOWN] Cleaning up resources...\n\n');

  const errors: string[] = [];

  // Close retry worker first (depends on Redis connection)
  try {
    const { closeRetryWorker } = await import('../src/workers/messageRetryWorker.js');
    await closeRetryWorker();
    process.stdout.write('[TEARDOWN] Retry worker closed\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[TEARDOWN] Worker close failed: ${msg}\n`);
    errors.push(`Worker close: ${msg}`);
  }

  // Close message retry queue (depends on Redis connection)
  try {
    const { closeRetryQueue } = await import('../src/infrastructure/queues.client.js');
    await closeRetryQueue();
    process.stdout.write('[TEARDOWN] Message retry queue closed\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[TEARDOWN] Queue close failed: ${msg}\n`);
    errors.push(`Queue close: ${msg}`);
  }

  // Close Redis client (after queue/worker which depend on it)
  try {
    const { closeRedisClient } = await import('../src/infrastructure/redis.client.js');
    await closeRedisClient();
    process.stdout.write('[TEARDOWN] Redis connection closed\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[TEARDOWN] Redis close failed: ${msg}\n`);
    errors.push(`Redis close: ${msg}`);
  }

  // Close database connection last (independent)
  try {
    const { closeDatabase } = await import('../src/infrastructure/db.client.js');
    await closeDatabase();
    process.stdout.write('[TEARDOWN] Database connection closed\n');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[TEARDOWN] Database close failed: ${msg}\n`);
    errors.push(`Database close: ${msg}`);
  }

  process.stdout.write('[TEARDOWN] Test suite cleanup completed\n\n');

  // Fail if any cleanup operations failed
  if (errors.length > 0) {
    const errorSummary = errors.join('; ');
    process.stderr.write(`[TEARDOWN] FAILED with ${errors.length} error(s): ${errorSummary}\n`);
    throw new Error(`Teardown failed: ${errorSummary}`);
  }
}
