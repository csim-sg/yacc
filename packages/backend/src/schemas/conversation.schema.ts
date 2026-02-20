import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './user.schema';
import { integrationConnectionProfiles } from './integrationConnectionProfile.schema';
import { conversationStatusEnum } from '../enums/conversationStatus.enum';
import { conversationPriorityEnum } from '../enums/conversationPriority.enum';
import { channelTypeEnum } from '../enums/channelType.enum';

/**
 * Conversations table - represents a conversation thread (one per group/channel)
 *
 * Profile-scoped uniqueness (especially for IRC):
 * - IRC channel: unique per (ircProfileId, externalThreadId)
 * - IRC DM: unique per (ircProfileId, externalUserId)
 * - Telegram: no profile scoping (single tenant MVP)
 *
 * Indexes:
 * - (channel, externalThreadId) for backward compat with Telegram
 * - (ircProfileId, externalThreadId) for IRC channels with profile awareness
 * - (ircProfileId) for listing conversations by profile
 */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel: channelTypeEnum('channel').notNull(),
    externalThreadId: varchar('external_thread_id', { length: 255 }).notNull(),
    /**
     * IRC Profile ID (optional)
     * - Required for IRC conversations (channels and DMs)
     * - Null for Telegram conversations (single-tenant MVP)
     * - Enforces profile-scoped uniqueness for IRC
     */
    ircProfileId: integer('irc_profile_id').references(
      () => integrationConnectionProfiles.id,
      {
        onDelete: 'set null',
      }
    ),
    title: varchar('title', { length: 500 }),
    status: conversationStatusEnum('status').notNull().default('open'),
    priority: conversationPriorityEnum('priority').notNull().default('normal'),
    assignedUserId: text('assigned_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
  },
  (table) => [
    index('conversations_channel_idx').on(table.channel),
    /**
     * IRC uniqueness: (channel='irc', ircProfileId, externalThreadId)
     * Applied only when channel='irc' via WHERE clause
     * Allows multiple profiles on same channel without conflict
     */
    uniqueIndex('conversations_irc_profile_channel_idx')
      .on(table.channel, table.ircProfileId, table.externalThreadId)
      .where(sql`${table.channel} = 'irc'`),
    /**
     * Non-IRC uniqueness: (channel, externalThreadId) for Telegram/others
     * Applied only when channel != 'irc'
     * Maintains backward compatibility with Telegram
     */
    uniqueIndex('conversations_external_thread_idx')
      .on(table.channel, table.externalThreadId)
      .where(sql`${table.channel} != 'irc'`),
    index('conversations_irc_profile_id_idx').on(table.ircProfileId),
    index('conversations_status_idx').on(table.status),
    index('conversations_assigned_user_id_idx').on(table.assignedUserId),
    index('conversations_last_activity_at_idx').on(table.lastActivityAt),
  ]
);

export type Conversation = typeof conversations.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;
