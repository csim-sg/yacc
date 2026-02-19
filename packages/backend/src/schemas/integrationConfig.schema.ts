import { pgTable, serial, integer, varchar, text, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './user.schema';

/**
 * Integration Config table - persisted encrypted credentials for IRC and other integrations
 *
 * Stores encrypted credentials (AES-256-GCM) at rest.
 * Password is never returned in responses or logged.
 *
 * Architecture: DB-encrypted-at-rest (primary) with env fallback for backward compatibility.
 * See ADR-010: Integration Credentials Encryption Strategy.
 */
export const integrationConfigs = pgTable(
  'integration_configs',
  {
    id: serial('id').primaryKey(),
    
    /**
     * Platform type (e.g., 'irc', 'telegram')
     * Used as unique constraint key
     */
    platform: varchar('platform', { length: 50 }).notNull(),
    
    /**
     * Server address (e.g., 'irc.libera.chat')
     * Used by INT-006 config endpoint
     */
    server: varchar('server', { length: 255 }).notNull(),
    
    /**
     * Server port (e.g., 6667, 6697 for SSL)
     * Range: 1-65535
     */
    port: integer('port').notNull().default(6667),
    
    /**
     * Username/nick for authentication
     */
    username: varchar('username', { length: 255 }).notNull(),
    
    /**
     * Password encrypted with AES-256-GCM using INTEGRATION_CREDENTIALS_ENCRYPTION_KEY
     * Stored as hex-encoded string: format is 'iv:encryptedData:authTag'
     * Never returned in API responses
     */
    passwordEncrypted: text('password_encrypted'),
    
    /**
     * Flag indicating if password is set (without exposing actual password)
     * Used in responses to indicate hasPassword state
     */
    hasPassword: boolean('has_password').notNull().default(false),
    
    /**
     * Timestamp when password was last updated
     * Used to track credential rotation
     */
    passwordUpdatedAt: timestamp('password_updated_at'),
    
    /**
     * IRC channels to monitor (comma-separated JSON array as string)
     * Format: '["#channel1","#channel2"]'
     * Validated: min 1 item, each starts with '#', unique items
     */
    channels: text('channels').notNull(),
    
    /**
     * User who last updated this configuration
     * References users table
     */
    updatedByUserId: text('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    
    /**
     * Timestamps for audit trail
     */
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    /**
     * Unique constraint: one config per platform
     * Enforces single IRC/Telegram/etc config per deployment
     */
    uniqueIndex('integration_configs_platform_idx').on(table.platform),
  ]
);

export type IntegrationConfig = typeof integrationConfigs.$inferSelect;
export type IntegrationConfigInsert = typeof integrationConfigs.$inferInsert;
