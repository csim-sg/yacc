import { sql } from 'drizzle-orm';
import { db } from './client';
import { hashPassword } from '../auth/password';

/**
 * Run all migrations to set up the database schema
 */
export async function runMigrations() {
  try {
    console.log('🔄 Starting database migrations...');

    await db.execute(sql`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `);

    // Create enums first (must be done before table creation)
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM (
          'super_admin',
          'admin',
          'manager',
          'user'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE user_status AS ENUM (
          'active',
          'inactive',
          'suspended'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE conversation_status AS ENUM (
          'open',
          'pending',
          'resolved'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE conversation_priority AS ENUM (
          'low',
          'medium',
          'high',
          'urgent'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE message_status AS ENUM (
          'pending',
          'sent',
          'failed'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE message_direction AS ENUM (
          'inbound',
          'outbound'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE channel_type AS ENUM (
          'telegram',
          'irc',
          'whatsapp',
          'wechat',
          'meta',
          'x',
          'email',
          'slack'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('✅ Enums created');

    // Create tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        role user_role NOT NULL DEFAULT 'user',
        status user_status NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMP
      );
    `);

    // Add BetterAuth columns if they don't exist
    await db.execute(sql`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$;
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
      CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
      CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS password_reset_tokens_token_idx ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx ON password_reset_tokens(expires_at);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        channel channel_type NOT NULL,
        external_thread_id VARCHAR(255) NOT NULL,
        title VARCHAR(500),
        status conversation_status NOT NULL DEFAULT 'open',
        priority conversation_priority NOT NULL DEFAULT 'medium',
        assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(channel, external_thread_id)
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS conversations_channel_idx ON conversations(channel);
      CREATE INDEX IF NOT EXISTS conversations_status_idx ON conversations(status);
      CREATE INDEX IF NOT EXISTS conversations_assigned_user_id_idx ON conversations(assigned_user_id);
      CREATE INDEX IF NOT EXISTS conversations_last_activity_at_idx ON conversations(last_activity_at);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
        sender_name VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        status message_status NOT NULL DEFAULT 'pending',
        direction message_direction NOT NULL,
        external_message_id VARCHAR(255),
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON messages(sender_id);
      CREATE INDEX IF NOT EXISTS messages_status_idx ON messages(status);
      CREATE INDEX IF NOT EXISTS messages_direction_idx ON messages(direction);
      CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(7) NOT NULL DEFAULT '#808080',
        created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(name, created_by_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversation_tags (
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (conversation_id, tag_id)
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        body TEXT NOT NULL,
        mentions JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS notes_conversation_id_idx ON notes(conversation_id);
      CREATE INDEX IF NOT EXISTS notes_author_id_idx ON notes(author_id);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS routing_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        priority INTEGER NOT NULL DEFAULT 999,
        conditions JSONB NOT NULL,
        actions JSONB NOT NULL,
        created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        last_run_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS routing_rules_status_idx ON routing_rules(status);
      CREATE INDEX IF NOT EXISTS routing_rules_priority_idx ON routing_rules(priority);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS routing_rule_executions (
        id SERIAL PRIMARY KEY,
        rule_id UUID NOT NULL REFERENCES routing_rules(id) ON DELETE CASCADE,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        matched_conditions JSONB,
        applied_actions JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS routing_rule_executions_rule_id_idx ON routing_rule_executions(rule_id);
      CREATE INDEX IF NOT EXISTS routing_rule_executions_conversation_id_idx ON routing_rule_executions(conversation_id);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        metadata JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS audit_logs_entity_type_idx ON audit_logs(entity_type);
      CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS raw_payloads (
        id SERIAL PRIMARY KEY,
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        storage_key VARCHAR(500),
        expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS raw_payloads_message_id_idx ON raw_payloads(message_id);
      CREATE INDEX IF NOT EXISTS raw_payloads_expires_at_idx ON raw_payloads(expires_at);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        name VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size INTEGER NOT NULL,
        storage_key VARCHAR(500) NOT NULL,
        url TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS attachments_message_id_idx ON attachments(message_id);
    `);

    // BetterAuth tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        token TEXT NOT NULL UNIQUE,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS session_user_id_idx ON session(user_id);
      CREATE INDEX IF NOT EXISTS session_token_idx ON session(token);
      CREATE INDEX IF NOT EXISTS session_expires_at_idx ON session(expires_at);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);
      CREATE INDEX IF NOT EXISTS verification_expires_at_idx ON verification(expires_at);
    `);

    // Account table (for OAuth providers - required by BetterAuth)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS account_user_id_idx ON account(user_id);
      CREATE UNIQUE INDEX IF NOT EXISTS account_provider_account_idx ON account(provider_id, account_id);
    `);

    console.log('✅ All tables created successfully');

    // Create seed data (one super admin user)
    await seedDatabase();

    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Seed the database with initial data
 */
async function seedDatabase() {
  try {
    console.log('🌱 Seeding database...');

    // Check if super admin already exists
    const result = await db.execute(
      sql`SELECT COUNT(*) FROM users WHERE email = 'admin@yacc.local'`
    );

    if (result.rows[0].count === 0) {
      // Create super admin user
      // Default password: 'admin123' - MUST be changed on first login in production
      const hashedPassword = hashPassword('admin123');

      await db.execute(sql`
        INSERT INTO users (email, name, password_hash, role, status, email_verified)
        VALUES ('admin@yacc.local', 'System Administrator', ${hashedPassword}, 'super_admin', 'active', true)
      `);

      console.log('✅ Seed data created (super admin user)');
      console.log('   Email: admin@yacc.local');
      console.log('   Password: admin123');
      console.log('   ⚠️  CHANGE PASSWORD ON FIRST LOGIN!');
    } else {
      console.log('ℹ️  Database already seeded');
    }
  } catch (error) {
    console.error('⚠️  Seed failed (may already exist):', error);
  }
}

/**
 * Drop all tables (for development/testing only)
 */
export async function dropAllTables() {
  try {
    console.log('⚠️  Dropping all tables...');

    await db.execute(sql`
      DROP TABLE IF EXISTS account CASCADE;
      DROP TABLE IF EXISTS verification CASCADE;
      DROP TABLE IF EXISTS session CASCADE;
      DROP TABLE IF EXISTS attachments CASCADE;
      DROP TABLE IF EXISTS raw_payloads CASCADE;
      DROP TABLE IF EXISTS audit_logs CASCADE;
      DROP TABLE IF EXISTS routing_rule_executions CASCADE;
      DROP TABLE IF EXISTS routing_rules CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS notes CASCADE;
      DROP TABLE IF EXISTS conversation_tags CASCADE;
      DROP TABLE IF EXISTS tags CASCADE;
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS conversations CASCADE;
      DROP TABLE IF EXISTS password_reset_tokens CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Drop enums
    await db.execute(sql`
      DROP TYPE IF EXISTS channel_type CASCADE;
      DROP TYPE IF EXISTS message_direction CASCADE;
      DROP TYPE IF EXISTS message_status CASCADE;
      DROP TYPE IF EXISTS conversation_priority CASCADE;
      DROP TYPE IF EXISTS conversation_status CASCADE;
      DROP TYPE IF EXISTS user_status CASCADE;
      DROP TYPE IF EXISTS user_role CASCADE;
    `);

    console.log('✅ All tables dropped');
  } catch (error) {
    console.error('❌ Drop failed:', error);
    throw error;
  }
}
