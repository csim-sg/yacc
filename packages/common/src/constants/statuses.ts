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
