/**
 * Database Client (Singleton)
 *
 * Initializes and provides access to PostgreSQL database connection
 * Follows ADR-005: Infrastructure folder for client initialization
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config/config';
import { Pool } from 'pg';
import {users} from "@/schemas/user.schema";
import { appConfig } from '@/config/appConfig';
import { schemas } from '@/schemas';

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