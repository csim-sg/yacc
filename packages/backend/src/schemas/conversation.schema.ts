import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './user.schema';
import { conversationStatusEnum } from '../enums/conversationStatus.enum';
import { conversationPriorityEnum } from '../enums/conversationPriority.enum';
import { channelTypeEnum } from '../enums/channelType.enum';

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
  (table) => [
    index('conversations_channel_idx').on(table.channel),
    uniqueIndex('conversations_external_thread_idx').on(table.channel, table.externalThreadId),
    index('conversations_status_idx').on(table.status),
    index('conversations_assigned_user_id_idx').on(table.assignedUserId),
    index('conversations_last_activity_at_idx').on(table.lastActivityAt),
  ]
);

export type Conversation = typeof conversations.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;
