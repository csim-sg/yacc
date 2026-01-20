#!/usr/bin/env tsx
/**
 * Script to manually seed the admin user
 * Usage: tsx scripts/seed-admin.ts
 */
import 'dotenv/config';
import { db } from '../src/infrastructure/db/client';
import { hashPassword } from '../src/infrastructure/auth/password';
import { sql } from 'drizzle-orm';

async function seedAdmin() {
  try {
    console.log('🌱 Seeding admin user...');

    // Check if admin already exists
    const result = await db.execute(
      sql`SELECT COUNT(*) FROM users WHERE email = 'admin@yacc.local'`
    );

    if (result.rows[0].count === '0') {
      // Create super admin user
      const hashedPassword = hashPassword('admin123');

      await db.execute(sql`
        INSERT INTO users (email, name, password_hash, role, status, email_verified)
        VALUES ('admin@yacc.local', 'System Administrator', ${hashedPassword}, 'super_admin', 'active', true)
      `);

      console.log('✅ Admin user created successfully');
      console.log('   Email: admin@yacc.local');
      console.log('   Password: admin123');
      console.log('   ⚠️  CHANGE PASSWORD ON FIRST LOGIN!');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seedAdmin();
