#!/usr/bin/env tsx
/**
 * Test fixtures seeding script
 * Usage: tsx scripts/seed-test-fixtures.ts
 */
import 'dotenv/config';
import { dbClient } from '../src/infrastructure/db.client.js';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { users } from '../src/schemas/user.schema.js';
import { account } from '../src/schemas/account.schema.js';
import { conversations } from '../src/schemas/conversation.schema.js';
import { conversationTags } from '../src/schemas/conversationTag.schema.js';
import { tags } from '../src/schemas/tag.schema.js';
import { messages } from '../src/schemas/message.schema.js';
import { notes } from '../src/schemas/note.schema.js';
import { auditLogs } from '../src/schemas/auditLog.schema.js';

const FIXTURE = {
  users: {
    superAdmin: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@yacc.local',
      name: 'System Administrator',
      role: 'super_admin' as const,
    },
    admin: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'admin2@yacc.local',
      name: 'Admin User',
      role: 'admin' as const,
    },
    manager: {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'manager@yacc.local',
      name: 'Manager User',
      role: 'manager' as const,
    },
    user: {
      id: '00000000-0000-0000-0000-000000000004',
      email: 'user@yacc.local',
      name: 'Support User',
      role: 'user' as const,
    },
  },
  conversations: {
    telegram: {
      id: '00000000-0000-0000-0000-000000001001',
      channel: 'telegram' as const,
      externalThreadId: 'tg-mock-101',
      title: 'Mock Support Thread',
    },
    irc: {
      id: '00000000-0000-0000-0000-000000001002',
      channel: 'irc' as const,
      externalThreadId: 'irc-#support',
      title: 'IRC #support',
    },
  },
  tags: {
    vip: {
      name: 'VIP',
      color: '#2563EB',
    },
  },
} as const;

async function seedTestFixtures() {
  try {
    console.log('🧪 Seeding test fixtures...');

    // Clean existing fixture data (UUID-safe)
    // Important: delete by deterministic fixture IDs (not numeric comparisons)
    const fixtureConversationIds = [
      FIXTURE.conversations.telegram.id,
      FIXTURE.conversations.irc.id,
    ];

    // Remove audit logs that reference fixture conversations
    await dbClient.delete(auditLogs).where(
      and(
        eq(auditLogs.entityType, 'conversation'),
        inArray(auditLogs.entityId, fixtureConversationIds)
      )
    );

    // Remove dependent rows explicitly (defensive) then delete conversations
    await dbClient.delete(conversationTags).where(inArray(conversationTags.conversationId, fixtureConversationIds));
    await dbClient.delete(messages).where(inArray(messages.conversationId, fixtureConversationIds));
    await dbClient.delete(notes).where(inArray(notes.conversationId, fixtureConversationIds));

    // Delete fixture conversations (FK cascades should also handle most dependents)
    await dbClient.delete(conversations).where(inArray(conversations.id, fixtureConversationIds));

    // Delete fixture tag (by name+creator to avoid deleting user data)
    await dbClient
      .delete(tags)
      .where(
        and(
          eq(tags.createdById, FIXTURE.users.superAdmin.id),
          eq(tags.name, FIXTURE.tags.vip.name)
        )
      );

    // Ensure users exist for RBAC coverage (Better Auth compatible hash)
    const hashedPassword = await hashPassword('admin123');

    const fixtureUsers = [FIXTURE.users.superAdmin, FIXTURE.users.admin, FIXTURE.users.manager, FIXTURE.users.user];

    for (const u of fixtureUsers) {
      await dbClient
        .insert(users)
        .values({
          id: u.id,
          email: u.email,
          name: u.name,
          passwordHash: hashedPassword,
          role: u.role,
          status: 'active',
          emailVerified: true,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: u.name,
            passwordHash: hashedPassword,
            role: u.role,
            status: 'active',
            emailVerified: true,
            updatedAt: sql`now()`,
          },
        });

      // BetterAuth credential login requires an account row.
      // Use providerId='credential' and accountId=email.
      await dbClient
        .insert(account)
        .values({
          id: `${u.id}-credential`,
          userId: u.id,
          accountId: u.email,
          providerId: 'credential',
        })
        .onConflictDoUpdate({
          target: [account.providerId, account.accountId],
          set: {
            userId: u.id,
            updatedAt: sql`now()`,
          },
        });
    }

    // Create fixture tag (VIP) owned by super_admin
    const [vipTag] = await dbClient
      .insert(tags)
      .values({
        name: FIXTURE.tags.vip.name,
        color: FIXTURE.tags.vip.color,
        createdById: FIXTURE.users.superAdmin.id,
      })
      .onConflictDoUpdate({
        target: [tags.name, tags.createdById],
        set: {
          color: FIXTURE.tags.vip.color,
        },
      })
      .returning({ id: tags.id });

    if (!vipTag?.id) {
      throw new Error('Failed to create VIP tag for fixtures');
    }

    // Create Telegram conversation (assigned to super_admin)
    await dbClient
      .insert(conversations)
      .values({
        id: FIXTURE.conversations.telegram.id,
        channel: FIXTURE.conversations.telegram.channel,
        externalThreadId: FIXTURE.conversations.telegram.externalThreadId,
        title: FIXTURE.conversations.telegram.title,
        status: 'resolved',
        priority: 'medium',
        assignedUserId: FIXTURE.users.superAdmin.id,
        createdAt: sql`now() - interval '20 minutes'`,
        updatedAt: sql`now() - interval '15 minutes'`,
        lastActivityAt: sql`now() - interval '15 minutes'`,
      })
      .onConflictDoUpdate({
        target: conversations.id,
        set: {
          status: 'resolved',
          priority: 'medium',
          assignedUserId: FIXTURE.users.superAdmin.id,
          updatedAt: sql`now() - interval '15 minutes'`,
          lastActivityAt: sql`now() - interval '15 minutes'`,
        },
      });

    // Associate VIP tag to Telegram conversation
    await dbClient
      .insert(conversationTags)
      .values({
        conversationId: FIXTURE.conversations.telegram.id,
        tagId: vipTag.id,
      })
      .onConflictDoNothing();

    // Insert messages for Telegram conversation
    const [inbound] = await dbClient
      .insert(messages)
      .values({
        conversationId: FIXTURE.conversations.telegram.id,
        senderName: 'Alice',
        body: 'Hello from Telegram',
        status: 'sent',
        direction: 'inbound',
        createdAt: sql`now() - interval '12 minutes'`,
        updatedAt: sql`now() - interval '12 minutes'`,
      })
      .returning({ id: messages.id });

    await dbClient.insert(messages).values({
      conversationId: FIXTURE.conversations.telegram.id,
      senderName: 'Support',
      body: 'We are looking into this.',
      status: 'pending',
      direction: 'outbound',
      createdAt: sql`now() - interval '3 minutes'`,
      updatedAt: sql`now() - interval '3 minutes'`,
    });

    await dbClient.insert(messages).values({
      conversationId: FIXTURE.conversations.telegram.id,
      senderName: 'Support',
      body: 'This message failed to send.',
      status: 'failed',
      direction: 'outbound',
      createdAt: sql`now() - interval '4 minutes'`,
      updatedAt: sql`now() - interval '4 minutes'`,
    });

    const [latestInbound] = await dbClient
      .insert(messages)
      .values({
        conversationId: FIXTURE.conversations.telegram.id,
        senderName: 'Alice',
        body: 'Any updates?',
        status: 'sent',
        direction: 'inbound',
        createdAt: sql`now() - interval '2 minutes'`,
        updatedAt: sql`now() - interval '2 minutes'`,
      })
      .returning({ id: messages.id });

    // Insert internal notes
    await dbClient.insert(notes).values({
      conversationId: FIXTURE.conversations.telegram.id,
      authorId: FIXTURE.users.superAdmin.id,
      body: 'Internal note: follow up with customer.',
      createdAt: sql`now() - interval '9 minutes'`,
      updatedAt: sql`now() - interval '9 minutes'`,
    });

    await dbClient.insert(notes).values({
      conversationId: FIXTURE.conversations.telegram.id,
      authorId: FIXTURE.users.superAdmin.id,
      body: 'Internal note: pending status follow-up.',
      createdAt: sql`now() - interval '4 minutes'`,
      updatedAt: sql`now() - interval '4 minutes'`,
    });

    // Insert minimal audit log entries for timeline coverage
    await dbClient.insert(auditLogs).values({
      actorId: FIXTURE.users.superAdmin.id,
      action: 'conversation_assigned',
      entityType: 'conversation',
      entityId: FIXTURE.conversations.telegram.id,
      metadata: {
        oldAssignedUserId: null,
        newAssignedUserId: FIXTURE.users.superAdmin.id,
      },
      createdAt: sql`now() - interval '14 minutes'`,
    });

    await dbClient.insert(auditLogs).values({
      actorId: FIXTURE.users.superAdmin.id,
      action: 'conversation_tagged',
      entityType: 'conversation',
      entityId: FIXTURE.conversations.telegram.id,
      metadata: {
        tagId: vipTag.id,
      },
      createdAt: sql`now() - interval '13 minutes'`,
    });

    await dbClient.insert(auditLogs).values({
      actorId: FIXTURE.users.superAdmin.id,
      action: 'conversation_status_change',
      entityType: 'conversation',
      entityId: FIXTURE.conversations.telegram.id,
      metadata: {
        oldStatus: 'open',
        newStatus: 'resolved',
      },
      createdAt: sql`now() - interval '11 minutes'`,
    });

    // Second conversation: IRC channel (unassigned)
    await dbClient
      .insert(conversations)
      .values({
        id: FIXTURE.conversations.irc.id,
        channel: FIXTURE.conversations.irc.channel,
        externalThreadId: FIXTURE.conversations.irc.externalThreadId,
        title: FIXTURE.conversations.irc.title,
        status: 'open',
        priority: 'low',
        assignedUserId: null,
        createdAt: sql`now() - interval '1 hour'`,
        updatedAt: sql`now() - interval '30 minutes'`,
        lastActivityAt: sql`now() - interval '30 minutes'`,
      })
      .onConflictDoUpdate({
        target: conversations.id,
        set: {
          status: 'open',
          priority: 'low',
          assignedUserId: null,
          updatedAt: sql`now() - interval '30 minutes'`,
          lastActivityAt: sql`now() - interval '30 minutes'`,
        },
      });

    await dbClient.insert(messages).values({
      conversationId: FIXTURE.conversations.irc.id,
      senderName: 'bob',
      body: 'Hi, need help with API',
      status: 'sent',
      direction: 'inbound',
      createdAt: sql`now() - interval '30 minutes'`,
      updatedAt: sql`now() - interval '30 minutes'`,
    });

    // Optional raw payload rows are omitted here; they are not required for frontend smoke tests.
    void inbound;
    void latestInbound;

    console.log('✅ Test fixtures seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed test fixtures:', error);
    process.exit(1);
  }
}

seedTestFixtures();
