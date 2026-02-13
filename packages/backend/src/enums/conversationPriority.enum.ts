import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Conversation Priority Enum - Defines conversation urgency level
 * Aligned with product spec: low/normal/high/urgent (see .docs/01-product-specification.md)
 * low: Low priority
 * normal: Normal priority (default)
 * high: High priority
 * urgent: Urgent priority
 */
export const conversationPriorityEnum = pgEnum('conversation_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export type ConversationPriority = typeof conversationPriorityEnum.enumValues[number];
