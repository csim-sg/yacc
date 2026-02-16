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
  console.log('\n🔧 Global Setup: Preparing test environment...\n');

  try {
    // Import database client AFTER env vars are set
    const { dbClient } = await import('../src/infrastructure/db.client.js');

    console.log('📦 Verifying database connection...');

    // Simple test query to verify connection
    const result = await dbClient.execute('SELECT NOW() as now');
    
    // Safely extract timestamp without using 'any'
    if (result && typeof result === 'object' && 'rows' in result) {
      const rows = result.rows;
      if (Array.isArray(rows) && rows.length > 0) {
        const firstRow = rows[0];
        if (firstRow && typeof firstRow === 'object' && 'now' in firstRow) {
          const timestamp = firstRow.now;
          console.log(`✅ Database connection successful (${timestamp})\n`);
        } else {
          console.log('✅ Database connection verified\n');
        }
      }
    } else {
      console.log('✅ Database connection verified\n');
    }

    // Run migrations to ensure schema is up-to-date
    console.log('📦 Running migrations...');
    try {
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      const { Pool } = await import('pg');
      
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      
      const migrationClient = (await import('drizzle-orm/node-postgres')).drizzle(pool);
      await migrate(migrationClient, { migrationsFolder: './drizzle' });
      
      await pool.end();
      console.log('✅ Migrations applied\n');
    } catch (migrationError: unknown) {
      const migrationMsg = migrationError instanceof Error ? migrationError.message : String(migrationError);
      console.warn('⚠️ Migration warning (continuing):', migrationMsg, '\n');
      // Continue even if migrations fail - they may already be applied
    }

    console.log('✅ Test environment ready\n');
  } catch (error: unknown) {
    // Safely handle error without using 'any'
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Global setup failed:', errorMessage);
    console.error('Make sure PostgreSQL is running and migrations have been applied');
    throw error;
  }
}

/**
 * Global teardown function - runs once after all tests
 */
export async function teardown() {
  console.log('\n🧹 Global Teardown: Cleaning up...\n');

  try {
    // For now, just log completion
    console.log('✅ Test suite cleanup completed\n');
  } catch (error: unknown) {
    // Safely handle error without using 'any'
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('⚠️ Teardown warning:', errorMessage);
    // Don't fail on teardown errors
  }
}
