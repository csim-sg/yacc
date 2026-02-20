import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { messages } from './message.schema';
import { conversations } from './conversation.schema';

/**
 * Dead Letter Queue table - stores messages that failed after 3 retry attempts
 *
 * Purpose: Persistent storage for failed messages requiring ops investigation and manual intervention
 * Retention: 7 days (auto-cleanup via scheduled job)
 * Access: Manager+ roles only
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
    
    // Failure tracking
    failureReason: text('failure_reason').notNull(), // 'max_retries_exceeded', 'validation_error', 'platform_error', 'network_error', 'unknown'
    totalAttempts: integer('total_attempts').notNull().default(3),
    lastError: text('last_error').notNull(),
    
    // Traceability fields for ops investigation
    correlationId: text('correlation_id'), // Request correlation ID for tracing async delivery
    ircProfileId: uuid('irc_profile_id'), // For IRC-specific context (optional)
    externalThreadType: text('external_thread_type'), // e.g., 'telegram_group', 'irc_channel'
    externalThreadId: text('external_thread_id'), // External platform's thread/conversation ID
    
    // Timestamps
    movedAt: timestamp('moved_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(), // Set to NOW() + 7 days
    
    // Re-queue tracking (if manually retried from DLQ)
    retryAttempt: boolean('retry_attempt').default(false),
    retriedAt: timestamp('retried_at'),
    retriedBy: uuid('retried_by'), // User who retried
    
    // Metadata: stores external/job IDs and other context
    // Example: { jobId: "msg-...", externalMessageId: "...", platform: "telegram" }
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
    index('dlq_correlation_id_idx').on(table.correlationId), // For tracing async delivery
    index('dlq_irc_profile_id_idx').on(table.ircProfileId), // For IRC-specific queries
  ]
);

export type DeadLetterQueueEntry = typeof deadLetterQueue.$inferSelect;
export type DeadLetterQueueInsert = typeof deadLetterQueue.$inferInsert;
