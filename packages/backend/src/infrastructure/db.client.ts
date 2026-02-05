/**
 * Database Client (Singleton)
 *
 * Initializes and provides access to PostgreSQL database connection
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { appConfig } from '../config/appConfig';
import { Pool } from 'pg';
import { schemas } from '../schemas';

// Singleton: Initialize connection pool once at module load
const pool = new Pool({
  connectionString: appConfig.DATABASE_URL,
  min: appConfig.DATABASE_MIN_CONNECTIONS,
  max: appConfig.DATABASE_MAX_CONNECTIONS,
});

export const dbClient = drizzle({
  client: pool,
  schema: schemas,
});

/**
 * Check database connection health
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT NOW()');
    return true;
  } catch (error) {
    return false;
  }
}