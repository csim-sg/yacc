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
import { routingRules } from '../src/schemas/routingRule.schema.js';
import { routingRuleExecutions } from '../src/schemas/routingRuleExecution.schema.js';
import { notifications } from '../src/schemas/notification.schema.js';

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
    urgent: {
      name: 'Urgent',
      color: '#EF4444',
    },
    followUp: {
      name: 'Follow-Up',
      color: '#F97316',
    },
  },
  routingRules: [
    {
      id: '00000000-0000-0000-0000-000000002001',
      name: 'Auto-assign VIP to admin',
      priority: 1,
      status: 'active',
      conditions: JSON.stringify({
        tag: 'VIP',
      }),
      actions: JSON.stringify({
        assignTo: '00000000-0000-0000-0000-000000000002', // admin user
      }),
    },
    {
      id: '00000000-0000-0000-0000-000000002002',
      name: 'Auto-tag urgent keywords',
      priority: 2,
      status: 'active',
      conditions: JSON.stringify({
        keyword: ['urgent', 'critical', 'emergency'],
      }),
      actions: JSON.stringify({
        addTag: 'Urgent',
        setPriority: 'high',
      }),
    },
    {
      id: '00000000-0000-0000-0000-000000002003',
      name: 'Disabled rule for testing',
      priority: 3,
      status: 'disabled',
      conditions: JSON.stringify({
        channel: 'telegram',
      }),
      actions: JSON.stringify({
        addTag: 'Telegram',
      }),
    },
  ],
  bulkTestConversations: {
    // Will create 105 conversations for bulk action testing (max 100 + overflow)
    count: 105,
    channels: ['telegram', 'irc'],
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
        priority: 'normal',
        assignedUserId: FIXTURE.users.superAdmin.id,
        createdAt: sql`now() - interval '20 minutes'`,
        updatedAt: sql`now() - interval '15 minutes'`,
        lastActivityAt: sql`now() - interval '15 minutes'`,
      })
      .onConflictDoUpdate({
        target: conversations.id,
        set: {
          status: 'resolved',
          priority: 'normal',
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

    // === PHASE 1 ACCEPTANCE TESTING FIXTURES ===
    console.log('🧪 Seeding Phase 1 fixtures (100 conversations for testing)...');

    /**
     * Create 100 Phase 1 test conversations for comprehensive acceptance testing
     * - 60 Telegram conversations (various statuses and priorities)
     * - 40 IRC conversations (various statuses and priorities)
     * - Varied assignments (50% to manager, 50% unassigned)
     * - Varied message counts and statuses
     */
    const phase1ConversationIds: string[] = [];
    for (let i = 0; i < 100; i++) {
      const channel = i < 60 ? 'telegram' : 'irc';
      const status = ['open', 'pending', 'resolved'][i % 3] as 'open' | 'pending' | 'resolved';
      const priority = ['low', 'normal', 'high', 'urgent'][(i % 4)] as 'low' | 'normal' | 'high' | 'urgent';
      const assignedUserId = i % 2 === 0 ? FIXTURE.users.manager.id : null;
      const conversationId = `10000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`;

      phase1ConversationIds.push(conversationId);

      const externalThreadId = channel === 'telegram' 
        ? `tg-phase1-${i}` 
        : `irc-#phase1-${i}`;

      // Calculate timestamps using Date objects instead of SQL intervals
      const now = new Date();
      const minutesBackCreated = (100 - i) * 5;
      const minutesBackUpdated = (100 - i) * 2;
      
      const createdDate = new Date(now.getTime() - minutesBackCreated * 60 * 1000);
      const updatedDate = new Date(now.getTime() - minutesBackUpdated * 60 * 1000);

      await dbClient
        .insert(conversations)
        .values({
          id: conversationId,
          channel: channel as 'telegram' | 'irc',
          externalThreadId,
          title: `${channel.toUpperCase()} ${status} conversation ${i + 1}`,
          status,
          priority,
          assignedUserId,
          createdAt: createdDate,
          updatedAt: updatedDate,
          lastActivityAt: updatedDate,
        })
        .onConflictDoNothing();

      // Add 2-5 messages per conversation with varied statuses
      const messageCount = 2 + (i % 4);
      for (let j = 0; j < messageCount; j++) {
        const messageStatus = j < 2 ? 'sent' : (j === messageCount - 1 ? 'pending' : (Math.random() > 0.8 ? 'failed' : 'sent'));
        const messageMinutesBack = (messageCount - j) * 10;
        
        const messageDate = new Date(now.getTime() - messageMinutesBack * 60 * 1000);
        
        await dbClient
          .insert(messages)
          .values({
            conversationId,
            senderName: j % 2 === 0 ? `customer_${i}` : 'support',
            body: `Phase 1 test message ${j + 1} for conversation ${i + 1}`,
            status: messageStatus as 'sent' | 'pending' | 'failed',
            direction: j % 2 === 0 ? 'inbound' : 'outbound',
            createdAt: messageDate,
            updatedAt: messageDate,
          })
          .onConflictDoNothing();
      }
    }

    console.log(`✅ Phase 1 fixtures seeded: 100 conversations with ${phase1ConversationIds.length} total created`);

    // === PHASE 2 ACCEPTANCE TESTING FIXTURES ===
    console.log('🧪 Seeding Phase 2 fixtures...');

    // Create additional tags for phase 2 testing
    const urgentTag = await dbClient
      .insert(tags)
      .values({
        name: FIXTURE.tags.urgent.name,
        color: FIXTURE.tags.urgent.color,
        createdById: FIXTURE.users.superAdmin.id,
      })
      .onConflictDoUpdate({
        target: [tags.name, tags.createdById],
        set: {
          color: FIXTURE.tags.urgent.color,
        },
      })
      .returning({ id: tags.id })
      .then(r => r[0]);

    const followUpTag = await dbClient
      .insert(tags)
      .values({
        name: FIXTURE.tags.followUp.name,
        color: FIXTURE.tags.followUp.color,
        createdById: FIXTURE.users.manager.id,
      })
      .onConflictDoUpdate({
        target: [tags.name, tags.createdById],
        set: {
          color: FIXTURE.tags.followUp.color,
        },
      })
      .returning({ id: tags.id })
      .then(r => r[0]);

    // Create routing rules for phase 2 testing
    for (const rule of FIXTURE.routingRules) {
      await dbClient
        .insert(routingRules)
        .values({
          id: rule.id,
          name: rule.name,
          priority: rule.priority,
          status: rule.status,
          conditions: rule.conditions,
          actions: rule.actions,
          createdById: FIXTURE.users.superAdmin.id,
        })
        .onConflictDoUpdate({
          target: routingRules.id,
          set: {
            name: rule.name,
            priority: rule.priority,
            status: rule.status,
            conditions: rule.conditions,
            actions: rule.actions,
            updatedAt: sql`now()`,
          },
        });
    }

    // Create bulk test conversations (for testing max 100 limit + partial failure)
    const bulkConversationIds: string[] = [];
    for (let i = 0; i < FIXTURE.bulkTestConversations.count; i++) {
      const channel = FIXTURE.bulkTestConversations.channels[i % 2];
      // Generate proper UUID format: ensure 12 zero-padded digits in last section
      const bulkNum = 3000 + i;
      const conversationId = `00000000-0000-0000-0000-${String(bulkNum).padStart(12, '0')}`;
      bulkConversationIds.push(conversationId);

      await dbClient
        .insert(conversations)
        .values({
          id: conversationId,
          channel: channel as 'telegram' | 'irc',
          externalThreadId: `bulk-test-${i}`,
          title: `Bulk Test Conversation ${i + 1}`,
          status: 'open',
          priority: 'normal',
          assignedUserId: i % 3 === 0 ? FIXTURE.users.manager.id : null,
        })
        .onConflictDoNothing();
    }

    // Create notifications for testing (assignment + mention triggers)
    await dbClient
      .insert(notifications)
      .values({
        userId: FIXTURE.users.manager.id,
        type: 'assignment',
        conversationId: FIXTURE.conversations.telegram.id,
        actorId: FIXTURE.users.superAdmin.id,
        message: 'You were assigned to Mock Support Thread',
        isRead: false,
        createdAt: sql`now() - interval '5 minutes'`,
      })
      .onConflictDoNothing();

    await dbClient
      .insert(notifications)
      .values({
        userId: FIXTURE.users.user.id,
        type: 'mention',
        conversationId: FIXTURE.conversations.irc.id,
        actorId: FIXTURE.users.manager.id,
        message: 'You were mentioned in IRC #support',
        isRead: false,
        createdAt: sql`now() - interval '2 minutes'`,
      })
      .onConflictDoNothing();

    await dbClient
      .insert(notifications)
      .values({
        userId: FIXTURE.users.admin.id,
        type: 'assignment',
        conversationId: FIXTURE.conversations.irc.id,
        actorId: FIXTURE.users.superAdmin.id,
        message: 'You were assigned to IRC #support',
        isRead: true,
        createdAt: sql`now() - interval '10 minutes'`,
      })
      .onConflictDoNothing();

    // Add more audit logs for phase 2 audit testing
    await dbClient.insert(auditLogs).values({
      actorId: FIXTURE.users.manager.id,
      action: 'bulk_action_applied',
      entityType: 'conversation',
      entityId: FIXTURE.conversations.irc.id,
      metadata: {
        operationType: 'assign',
        count: 5,
      },
      createdAt: sql`now() - interval '3 minutes'`,
    });

    // Add rule execution logs for testing rule query APIs
    // Note: Skip if routing rules not created yet (dependency)
    try {
      const existingRule = await dbClient.query.routingRules.findFirst({
        where: eq(routingRules.id, FIXTURE.routingRules[0].id as any),
      });

      if (existingRule) {
        await dbClient.insert(routingRuleExecutions).values({
          ruleId: FIXTURE.routingRules[0].id as any,
          conversationId: FIXTURE.conversations.telegram.id as any,
          matchedConditions: JSON.stringify({
            tag: 'VIP',
          }),
          appliedActions: JSON.stringify({
            assignTo: '00000000-0000-0000-0000-000000000002',
          }),
          createdAt: sql`now() - interval '1 minute'`,
        });
      }
    } catch (err) {
      console.warn('⚠️  Skipped rule execution log (rule may not exist yet)');
    }

    console.log(`✅ Phase 2 fixtures seeded successfully (${FIXTURE.bulkTestConversations.count} bulk conversations created)`);
    console.log('✅ Test fixtures seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed test fixtures:', error);
    process.exit(1);
  }
}

seedTestFixtures();
