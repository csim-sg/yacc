import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Conversation Priority Enum - Defines conversation urgency level
 * low: Low priority
 * medium: Medium priority (default)
 * high: High priority
 * urgent: Urgent priority
 */
export const conversationPriorityEnum = pgEnum('conversation_priority', [
  'low',
  'medium',
  'high',
  'urgent',
]);

export type ConversationPriority = typeof conversationPriorityEnum.enumValues[number];
