/**
 * Database Configuration
 *
 * DEPRECATED: Use infrastructure/db.client.ts instead
 * Kept for backwards compatibility during migration
 * Will be removed once all imports updated
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import { config } from './config';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: config.database.url,
});

// Create drizzle instance without schema param initially
// Schema will be inferred from infrastructure/db.schema.ts
export const db = drizzle(pool);

// Health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

export default db;
