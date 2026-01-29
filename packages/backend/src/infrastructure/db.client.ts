/**
 * Database Client (Singleton)
 *
 * Initializes and provides access to PostgreSQL database connection
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config/config';
import { Pool } from 'pg';

// Singleton: Initialize connection pool once at module load
const pool = new Pool({
  connectionString: config.database.url,
  min: 2,
  max: 10,
});

export const dbClient = drizzle({client: pool});

/**
 * Check database connection health
 */
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

/**
 * Get PostgreSQL pool (for direct access if needed)
 */
export function getPool(): Pool {
  return pool;
}
