import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'admin',
  'manager',
  'user',
]);

export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'suspended']);

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

export const messageStatusEnum = pgEnum('message_status', ['pending', 'sent', 'failed']);

export const messageDirectionEnum = pgEnum('message_direction', ['inbound', 'outbound']);

export const channelTypeEnum = pgEnum('channel_type', ['irc']); // Phase 1 MVP: IRC only. Expand to include telegram, email, slack in Phase 2+

// Tables

/**
 * Users table - stores user accounts
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRoleEnum('role').notNull().default('user'),
    status: userStatusEnum('status').notNull().default('active'),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at'),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
    statusIdx: index('users_status_idx').on(table.status),
  })
);

/**
 * PasswordResetTokens table - stores password reset tokens with expiry
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('password_reset_tokens_user_id_idx').on(table.userId),
    tokenIdx: index('password_reset_tokens_token_idx').on(table.token),
    expiresAtIdx: index('password_reset_tokens_expires_at_idx').on(table.expiresAt),
  })
);

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

/**
 * Messages table - stores individual messages
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id').references(() => users.id, { onDelete: 'set null' }),
    senderName: varchar('sender_name', { length: 255 }).notNull(),
    body: text('body').notNull(),
    status: messageStatusEnum('status').notNull().default('pending'),
    direction: messageDirectionEnum('direction').notNull(),
    externalMessageId: varchar('external_message_id', { length: 255 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    conversationIdIdx: index('messages_conversation_id_idx').on(table.conversationId),
    senderIdIdx: index('messages_sender_id_idx').on(table.senderId),
    statusIdx: index('messages_status_idx').on(table.status),
    directionIdx: index('messages_direction_idx').on(table.direction),
    createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  })
);

/**
 * Tags table - user-created tags for organizing conversations
 */
export const tags = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    color: varchar('color', { length: 7 }).notNull().default('#808080'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    nameCreatedByIdx: uniqueIndex('tags_name_created_by_idx').on(table.name, table.createdById),
  })
);

/**
 * ConversationTags junction table - M:M relationship between conversations and tags
 */
export const conversationTags = pgTable(
  'conversation_tags',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pkey: uniqueIndex('conversation_tags_pkey').on(table.conversationId, table.tagId),
  })
);

/**
 * Notes table - internal notes on conversations (not sent to customers)
 */
export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    mentions: jsonb('mentions'), // Array of user IDs mentioned in note
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    conversationIdIdx: index('notes_conversation_id_idx').on(table.conversationId),
    authorIdIdx: index('notes_author_id_idx').on(table.authorId),
  })
);

/**
 * Notifications table - in-app notifications for users
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(), // 'assignment', 'mention', etc.
    conversationId: uuid('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    message: text('message').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    isReadIdx: index('notifications_is_read_idx').on(table.isRead),
    createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
  })
);

/**
 * RoutingRules table - stores automated routing rules
 */
export const routingRules = pgTable(
  'routing_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull().default('active'), // 'active', 'disabled'
    priority: integer('priority').notNull().default(999), // Lower number = higher priority
    conditions: jsonb('conditions').notNull(), // JSON array of conditions
    actions: jsonb('actions').notNull(), // JSON array of actions
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    lastRunAt: timestamp('last_run_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index('routing_rules_status_idx').on(table.status),
    priorityIdx: index('routing_rules_priority_idx').on(table.priority),
  })
);

/**
 * RoutingRuleExecutions table - audit trail of rule executions
 */
export const routingRuleExecutions = pgTable(
  'routing_rule_executions',
  {
    id: serial('id').primaryKey(),
    ruleId: uuid('rule_id')
      .notNull()
      .references(() => routingRules.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    matchedConditions: jsonb('matched_conditions'),
    appliedActions: jsonb('applied_actions'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    ruleIdIdx: index('routing_rule_executions_rule_id_idx').on(table.ruleId),
    conversationIdIdx: index('routing_rule_executions_conversation_id_idx').on(table.conversationId),
  })
);

/**
 * AuditLogs table - comprehensive audit trail of all actions
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 255 }).notNull(), // e.g., 'assignment', 'tag', 'note', 'status_change'
    entityType: varchar('entity_type', { length: 50 }).notNull(), // e.g., 'conversation', 'message', 'user'
    entityId: uuid('entity_id').notNull(),
    metadata: jsonb('metadata'), // Additional context (old value, new value, etc.)
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    actorIdIdx: index('audit_logs_actor_id_idx').on(table.actorId),
    actionIdx: index('audit_logs_action_idx').on(table.action),
    entityTypeIdx: index('audit_logs_entity_type_idx').on(table.entityType),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
);

/**
 * RawPayloads table - stores raw payloads from external platforms (7-day retention)
 */
export const rawPayloads = pgTable(
  'raw_payloads',
  {
    id: serial('id').primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 50 }).notNull(), // 'telegram', 'irc', etc.
    payload: jsonb('payload').notNull(),
    storageKey: varchar('storage_key', { length: 500 }), // S3/R2 object key for large payloads
    expiresAt: timestamp('expires_at')
      .notNull()
      .default(sql`NOW() + INTERVAL '7 days'`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    messageIdIdx: index('raw_payloads_message_id_idx').on(table.messageId),
    expiresAtIdx: index('raw_payloads_expires_at_idx').on(table.expiresAt),
  })
);

/**
 * Attachments table - stores attachment metadata
 */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 500 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: integer('size').notNull(),
    storageKey: varchar('storage_key', { length: 500 }).notNull(), // S3/R2 object key
    url: text('url').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    messageIdIdx: index('attachments_message_id_idx').on(table.messageId),
  })
);

/**
 * Session table - BetterAuth session management
 */
export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('session_user_id_idx').on(table.userId),
    tokenIdx: index('session_token_idx').on(table.token),
    expiresAtIdx: index('session_expires_at_idx').on(table.expiresAt),
  })
);

/**
 * Verification table - BetterAuth email/phone verification
 */
export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(), // email or phone
    value: text('value').notNull(), // verification code/token
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    identifierIdx: index('verification_identifier_idx').on(table.identifier),
    expiresAtIdx: index('verification_expires_at_idx').on(table.expiresAt),
  })
);

/**
 * Account table - BetterAuth OAuth provider accounts
 */
export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('account_user_id_idx').on(table.userId),
    providerAccountIdx: uniqueIndex('account_provider_account_idx').on(
      table.providerId,
      table.accountId
    ),
  })
);

// Types for inference
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type PasswordResetTokenInsert = typeof passwordResetTokens.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type ConversationInsert = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;

export type Tag = typeof tags.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type NoteInsert = typeof notes.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = typeof notifications.$inferInsert;

export type RoutingRule = typeof routingRules.$inferSelect;
export type RoutingRuleInsert = typeof routingRules.$inferInsert;

export type RoutingRuleExecution = typeof routingRuleExecutions.$inferSelect;
export type RoutingRuleExecutionInsert = typeof routingRuleExecutions.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;

export type RawPayload = typeof rawPayloads.$inferSelect;
export type RawPayloadInsert = typeof rawPayloads.$inferInsert;

export type Attachment = typeof attachments.$inferSelect;
export type AttachmentInsert = typeof attachments.$inferInsert;

export type Session = typeof session.$inferSelect;
export type SessionInsert = typeof session.$inferInsert;

export type Verification = typeof verification.$inferSelect;
export type VerificationInsert = typeof verification.$inferInsert;

export type Account = typeof account.$inferSelect;
export type AccountInsert = typeof account.$inferInsert;
