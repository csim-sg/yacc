import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema';

export const conversationStatusEnum = pgEnum('conversation_status', [
  'open',
  'pending',
  'resolved',
]);

export const conversationPriorityEnum = pgEnum('conversation_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export const channelTypeEnum = pgEnum('channel_type', [
  'telegram',
  'irc',
  'whatsapp',
  'wechat',
  'meta',
  'x',
  'email',
  'slack',
]);

/**
 * Conversations table - represents a conversation thread (one per group/channel)
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel: channelTypeEnum('channel').notNull(),
    externalThreadId: varchar('external_thread_id', { length: 255 }).notNull(),
    title: varchar('title', { length: 500 }),
    status: conversationStatusEnum('status').notNull().default('open'),
    priority: conversationPriorityEnum('priority').notNull().default('medium'),
    assignedUserId: uuid('assigned_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
  },
  (table) => ({
    channelIdx: index('conversations_channel_idx').on(table.channel),
    externalThreadIdx: uniqueIndex('conversations_external_thread_idx').on(table.channel, table.externalThreadId),
    statusIdx: index('conversations_status_idx').on(table.status),
    assignedUserIdIdx: index('conversations_assigned_user_id_idx').on(table.assignedUserId),
    lastActivityAtIdx: index('conversations_last_activity_at_idx').on(table.lastActivityAt),
  })
);

export type Conversation = typeof conversations.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;
