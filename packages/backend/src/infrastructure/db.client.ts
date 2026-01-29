/**
 * Database Client
 *
 * Initializes and provides access to PostgreSQL database connection
 * Follows ADR-005: Infrastructure folder for client initialization with DI
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
import { config } from '../config/config';

const { Pool } = pkg;

/**
 * Database client class
 * Manages PostgreSQL connection pool and Drizzle ORM instance
 * Uses DI pattern: accepts config in constructor
 */
export class Database {
  private pool: Pool;
  private drizzleInstance: any;

  /**
   * Initialize database connection with provided config
   */
  constructor(dbConfig: { url: string } = { url: config.app.databaseUrl }) {
    this.pool = new Pool({
      connectionString: dbConfig.url,
    });

    this.drizzleInstance = drizzle({client: this.pool});
  }

  /**
   * Get PostgreSQL pool
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Get Drizzle ORM instance
   */
  getDrizzle(): any {
    return this.drizzleInstance;
  }

  /**
   * Check database connection health
   */
  async checkConnection(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT NOW()');
      console.log('✅ Database connected:', result.rows[0]);
      return true;
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('Database connection closed');
  }
}
