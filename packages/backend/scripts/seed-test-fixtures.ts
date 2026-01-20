#!/usr/bin/env tsx
/**
 * Test fixtures seeding script
 * Usage: tsx scripts/seed-test-fixtures.ts
 */
import 'dotenv/config';
import { db } from '../src/infrastructure/db/client';
import { hashPassword } from '../src/infrastructure/auth/password';
import { sql } from 'drizzle-orm';

async function seedTestFixtures() {
  try {
    console.log('🧪 Seeding test fixtures...');

    // Clean existing test data
    await db.execute(sql`DELETE FROM raw_payloads WHERE message_id IN (SELECT id FROM messages WHERE conversation_id >= 1000)`);
    await db.execute(sql`DELETE FROM audit_logs WHERE entity_type = 'conversation' AND entity_id >= 1000`);
    await db.execute(sql`DELETE FROM messages WHERE conversation_id >= 1000`);
    await db.execute(sql`DELETE FROM notes WHERE conversation_id >= 1000`);
    await db.execute(sql`DELETE FROM conversation_tags WHERE conversation_id >= 1000`);
    await db.execute(sql`DELETE FROM conversations WHERE id >= 1000`);
    await db.execute(sql`DELETE FROM tags WHERE id >= 1000`);

    // Ensure users exist for RBAC coverage
    const hashedPassword = hashPassword('admin123');
    const [adminRow] = (await db.execute(sql`
      INSERT INTO users (email, name, password_hash, role, status, email_verified)
      VALUES ('admin@yacc.local', 'System Administrator', ${hashedPassword}, 'super_admin', 'active', true)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `)).rows;
    const adminId = adminRow?.id;

    if (!adminId) {
      throw new Error('Failed to create admin user for fixtures');
    }

    await db.execute(sql`
      INSERT INTO users (email, name, password_hash, role, status, email_verified)
      VALUES ('admin2@yacc.local', 'Admin User', ${hashedPassword}, 'admin', 'active', true)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    `);

    await db.execute(sql`
      INSERT INTO users (email, name, password_hash, role, status, email_verified)
      VALUES ('manager@yacc.local', 'Manager User', ${hashedPassword}, 'manager', 'active', true)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    `);

    await db.execute(sql`
      INSERT INTO users (email, name, password_hash, role, status, email_verified)
      VALUES ('user@yacc.local', 'Support User', ${hashedPassword}, 'user', 'active', true)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
    `);

    // Create tag
    await db.execute(sql`
      INSERT INTO tags (id, name, color, created_by_id, created_at)
      VALUES (1001, 'VIP', '#2563EB', ${adminId}, NOW())
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
    `);

    // Create conversation
    await db.execute(sql`
      INSERT INTO conversations (id, channel, external_thread_id, title, status, priority, assigned_user_id, created_at, updated_at, last_activity_at)
      VALUES (1001, 'telegram', 'tg-mock-101', 'Mock Support Thread', 'resolved', 'medium', ${adminId}, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes')
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        assigned_user_id = EXCLUDED.assigned_user_id,
        updated_at = EXCLUDED.updated_at,
        last_activity_at = EXCLUDED.last_activity_at
    `);

    // Associate tag
    await db.execute(sql`
      INSERT INTO conversation_tags (conversation_id, tag_id)
      VALUES (1001, 1001)
      ON CONFLICT DO NOTHING
    `);

    // Insert messages
    const inboundResult = await db.execute(sql`
      INSERT INTO messages (conversation_id, sender_name, body, status, direction, created_at, updated_at)
      VALUES (1001, 'Alice', 'Hello from Telegram', 'sent', 'inbound', NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '12 minutes')
      RETURNING id
    `);
    const inboundMessageId = inboundResult.rows[0]?.id;

    await db.execute(sql`
      INSERT INTO messages (conversation_id, sender_name, body, status, direction, created_at, updated_at)
      VALUES (1001, 'Support', 'We are looking into this.', 'pending', 'outbound', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes')
    `);

    await db.execute(sql`
      INSERT INTO messages (conversation_id, sender_name, body, status, direction, created_at, updated_at)
      VALUES (1001, 'Support', 'This message failed to send.', 'failed', 'outbound', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes')
    `);


    await db.execute(sql`
      INSERT INTO messages (conversation_id, sender_name, body, status, direction, created_at, updated_at)
      VALUES (1001, 'Support', 'We are looking into this.', 'pending', 'outbound', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes')
    `);


    await db.execute(sql`
      INSERT INTO messages (conversation_id, sender_name, body, status, direction, created_at, updated_at)
      VALUES (1001, 'Support', 'We are looking into this.', 'pending', 'outbound', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes')
    `);

    const latestInboundResult = await db.execute(sql`
      INSERT INTO messages (conversation_id, sender_name, body, status, direction, created_at, updated_at)
      VALUES (1001, 'Alice', 'Any updates?', 'sent', 'inbound', NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes')
      RETURNING id
    `);
    const latestInboundId = latestInboundResult.rows[0]?.id;

    if (inboundMessageId) {
      await db.execute(sql`
        INSERT INTO raw_payloads (message_id, platform, payload, storage_key, created_at, expires_at)
        VALUES (${inboundMessageId}, 'telegram', '{"fixture": true}', 'payloads/test-1001.json', NOW() - INTERVAL '12 minutes', NOW() + INTERVAL '7 days')
        ON CONFLICT DO NOTHING
      `);
    }

    // Insert internal note
    await db.execute(sql`
      INSERT INTO notes (conversation_id, author_id, body, created_at, updated_at)
      VALUES (1001, ${adminId}, 'Internal note: follow up with customer.', NOW() - INTERVAL '9 minutes', NOW() - INTERVAL '9 minutes')
    `);

    await db.execute(sql`
      INSERT INTO notes (conversation_id, author_id, body, created_at, updated_at)
      VALUES (1001, ${adminId}, 'Internal note: pending status follow-up.', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes')
    `);

    // Audit log entries for assignment/tag/status change
    if (latestInboundId) {
      await db.execute(sql`
        INSERT INTO raw_payloads (message_id, platform, payload, storage_key, created_at, expires_at)
        VALUES (${latestInboundId}, 'telegram', '{"fixture": true}', 'payloads/test-1001-latest.json', NOW() - INTERVAL '2 minutes', NOW() + INTERVAL '7 days')
        ON CONFLICT DO NOTHING
      `);
    }

    // Audit log entries for assignment/tag/status change
    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (${adminId}, 'conversation_assigned', 'conversation', 1001, ${sql`jsonb_build_object('oldAssignedUserId', null, 'newAssignedUserId', ${sql`${adminId}::int`})`}, NOW() - INTERVAL '14 minutes')
    `);

    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (${adminId}, 'conversation_tagged', 'conversation', 1001, ${sql`jsonb_build_object('tagId', 1001)`}, NOW() - INTERVAL '13 minutes')
    `);

    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (${adminId}, 'conversation_status_change', 'conversation', 1001, ${sql`jsonb_build_object('oldStatus', 'open', 'newStatus', 'resolved')`}, NOW() - INTERVAL '11 minutes')
    `);

    await db.execute(sql`
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, created_at)
      VALUES (NULL, 'conversation_reopened', 'conversation', 1001, ${sql`jsonb_build_object('reason', 'inbound_message', 'oldStatus', 'resolved', 'newStatus', 'open')`}, NOW() - INTERVAL '2 minutes')
    `);

    console.log('✅ Test fixtures seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed test fixtures:', error);
    process.exit(1);
  }
}

seedTestFixtures();
