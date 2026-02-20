import { sql } from 'drizzle-orm';
import {
  pgTable,
  serial,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema';

/**
 * Integration Connection Profiles table
 *
 * Stores encrypted credentials for IRC (and other) integrations on a per-tenant basis.
 * - Each tenant can have 0..10 IRC profiles (cap enforced at service layer)
 * - At most one profile per (tenant, integration) can be active
 * - Active implies enabled; cannot be both active and disabled
 * - Disabling an active profile clears active (atomic)
 * - Deleting an active profile is rejected with 409
 *
 * Architecture:
 * - Credentials encrypted at rest using AES-256-GCM with INTEGRATION_CREDENTIALS_ENCRYPTION_KEY
 * - Encrypted format: 'iv:encryptedData:authTag' (hex-encoded)
 * - Secrets never returned in API responses, logs, or audit trails
 *
 * See ADR-010: Integration Credentials Encryption Strategy
 * See INT-010: IRC tenant-owned DB connection profiles
 */
export const integrationConnectionProfiles = pgTable(
  'integration_connection_profiles',
  {
    id: serial('id').primaryKey(),

    /**
     * Tenant ID (single default tenant in MVP)
     * Will be scoped to current tenant context in future multi-tenant
     */
    tenantId: uuid('tenant_id').notNull().default(sql`'00000000-0000-0000-0000-000000000000'`),

    /**
     * Integration type (e.g., 'irc', 'telegram')
     * Used to enforce one-active-per-integration constraint
     */
    integrationType: varchar('integration_type', { length: 50 }).notNull(),

    /**
     * Profile name (user-provided, e.g., 'Libera Chat - Primary', 'Freenode Legacy')
     * Helps distinguish multiple profiles for same integration
     */
    name: varchar('name', { length: 255 }).notNull(),

    /**
     * Is this profile enabled?
     * Disabled profiles count toward cap but cannot be active
     * Disabling an active profile clears is_active
     */
    isEnabled: boolean('is_enabled').notNull().default(true),

    /**
     * Is this profile active?
     * At most one per (tenant, integration)
     * Active implies enabled (CHECK constraint enforces this)
     * Cleared when profile is disabled (atomic)
     */
    isActive: boolean('is_active').notNull().default(false),

    /**
     * Encrypted credentials (e.g., IRC password, Telegram token)
     * Format: 'iv:encryptedData:authTag' (hex-encoded)
     * Encryption key: process.env.INTEGRATION_CREDENTIALS_ENCRYPTION_KEY
     * Never returned in responses or logged
     */
    encryptedCredentials: text('encrypted_credentials').notNull(),

    /**
     * Configuration payload (JSON)
     * For IRC: { server, port, username, channels }
     * For other integrations: integration-specific config
     * Never contains secrets (secrets go in encryptedCredentials)
     * Stored as plaintext (not sensitive, but validates schema at service layer)
     */
    config: text('config').notNull(), // JSON stringified

    /**
     * User who created this profile
     * References users table; set null if user deleted (but log audit event)
     * Nullable to handle user deletion while maintaining referential integrity
     */
    createdByUserId: text('created_by_id')
      .references(() => users.id, { onDelete: 'set null' }),

    /**
     * User who last updated this profile (e.g., password change, enable/disable, activate)
     * References users table; set null if user deleted
     */
    updatedByUserId: text('updated_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),

    /**
     * Last successful test connection (UTC timestamp)
     * Null if never tested or test failed
     * Used to show "Last tested: X minutes ago" in UI
     */
    lastTestedAt: timestamp('last_tested_at'),

    /**
     * Result of last test: true = passed, false = failed, null = never tested
     * Used to show pass/fail indicator without storing error details
     */
    lastTestPassed: boolean('last_test_passed'),

    /**
     * Timestamps for audit trail
     */
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    /**
     * Partial unique index: one active profile per (tenant, integration)
     * Only enforced where is_active = true
     * Allows multiple disabled profiles with same integration
     */
    uniqueIndex('integration_profiles_active_idx')
      .on(table.tenantId, table.integrationType, table.isActive)
      .where(sql`${table.isActive} = true`),

    /**
     * Regular index for finding all profiles for a tenant+integration
     * Used by: service layer to enforce cap, UI to list profiles
     */
    index('integration_profiles_tenant_integration_idx').on(
      table.tenantId,
      table.integrationType
    ),

    /**
     * Index for finding all active profiles (used during connector startup)
     */
    index('integration_profiles_active_idx_regular').on(table.isActive),

    /**
     * Index for audit queries (find profiles created by a user)
     */
    index('integration_profiles_created_by_idx').on(table.createdByUserId),
  ]
);

/**
 * CHECK constraint: if is_active = true, then is_enabled must = true
 * Enforces: "active implies enabled"
 * Cannot be enforced in Drizzle schema definition but will be added in migration
 */

export type IntegrationConnectionProfile =
  typeof integrationConnectionProfiles.$inferSelect;
export type IntegrationConnectionProfileInsert =
  typeof integrationConnectionProfiles.$inferInsert;
