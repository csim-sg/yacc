import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  varchar,
} from 'drizzle-orm/pg-core';
import { messages } from './message.schema';
import { conversations } from './conversation.schema';
import { integrationConnectionProfiles } from './integrationConnectionProfile.schema';

/**
 * Dead Letter Queue table - stores messages that failed after 3 retry attempts
 *
 * Purpose: Persistent storage for failed messages requiring ops investigation and manual intervention
 * Retention: 7 days (auto-cleanup via scheduled job)
 * Access: Manager+ roles only
 *
 * INT-012 Requirements:
 * - Includes correlationId for end-to-end tracing
 * - Includes ircProfileId + externalThreadType + externalThreadId for IRC-specific debugging
 * - Supports audit logging and permission enforcement (Manager+ only)
 */
export const deadLetterQueue = pgTable(
  'dead_letter_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    
    // Original message payload for re-sending
    payload: jsonb('payload').notNull(),
    
    // INT-012: Tracing and debugging fields
    /**
     * Correlation ID for end-to-end tracing (e.g., from outbound request through retry chain)
     * Used to trace failures back to original send request
     */
    correlationId: text('correlation_id'),
    
    /**
     * IRC-specific: Profile ID of the IRC connection (for profile-scoped DLQ querying)
     * Null for non-IRC platforms
     */
    ircProfileId: integer('irc_profile_id').references(
      () => integrationConnectionProfiles.id,
      { onDelete: 'set null' }
    ),
    
    /**
     * External thread type (e.g., 'channel' vs 'dm' for IRC)
     * Used for platform-specific DLQ management
     */
    externalThreadType: varchar('external_thread_type', { length: 50 }),
    
    /**
     * External thread ID (e.g., '#channel' for IRC channels, 'user' for DMs)
     * Used to identify the target thread for re-queueing
     */
    externalThreadId: varchar('external_thread_id', { length: 255 }),
    
    // Failure tracking
    failureReason: text('failure_reason').notNull(), // 'max_retries_exceeded', 'validation_error', 'platform_error', 'network_error', 'unknown'
    totalAttempts: integer('total_attempts').notNull().default(3),
    lastError: text('last_error').notNull(),
    
    // Timestamps
    movedAt: timestamp('moved_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(), // Set to NOW() + 7 days
    
    // Re-queue tracking (if manually retried from DLQ)
    retryAttempt: boolean('retry_attempt').default(false),
    retriedAt: timestamp('retried_at'),
    retriedBy: uuid('retried_by'), // User who retried
    
    // Metadata
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('dlq_message_id_idx').on(table.messageId),
    index('dlq_conversation_id_idx').on(table.conversationId),
    index('dlq_moved_at_idx').on(table.movedAt),
    index('dlq_expires_at_idx').on(table.expiresAt), // For cleanup queries
    index('dlq_failure_reason_idx').on(table.failureReason),
    index('dlq_retry_attempt_idx').on(table.retryAttempt),
    index('dlq_correlation_id_idx').on(table.correlationId), // INT-012: trace failures
    index('dlq_irc_profile_id_idx').on(table.ircProfileId), // INT-012: IRC-specific queries
  ]
);

export type DeadLetterQueueEntry = typeof deadLetterQueue.$inferSelect;
export type DeadLetterQueueInsert = typeof deadLetterQueue.$inferInsert;
