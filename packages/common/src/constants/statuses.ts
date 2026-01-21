/**
 * Conversation and Message Statuses
 */

export const CONVERSATION_STATUSES = {
  OPEN: 'open',
  PENDING: 'pending',
  RESOLVED: 'resolved',
} as const;

export const MESSAGE_STATUSES = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export const MESSAGE_DIRECTIONS = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export const PRIORITY_LEVELS = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const USER_STATUSES = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

export const NOTIFICATION_TYPES = {
  ASSIGNMENT: 'assignment',
  MENTION: 'mention',
} as const;

export const ROUTING_RULE_STATUSES = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

export type ConversationStatus = typeof CONVERSATION_STATUSES[keyof typeof CONVERSATION_STATUSES];
export type MessageStatus = typeof MESSAGE_STATUSES[keyof typeof MESSAGE_STATUSES];
export type MessageDirection = typeof MESSAGE_DIRECTIONS[keyof typeof MESSAGE_DIRECTIONS];
export type Priority = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS];
export type UserStatus = typeof USER_STATUSES[keyof typeof USER_STATUSES];
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
export type RoutingRuleStatus = typeof ROUTING_RULE_STATUSES[keyof typeof ROUTING_RULE_STATUSES];
