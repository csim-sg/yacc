import { z } from 'zod';

export const ChannelEnum = z.enum([
  'telegram',
  'irc',
  'whatsapp',
  'wechat',
  'meta',
  'x',
  'email',
  'slack',
]);
export const ConversationStatusEnum = z.enum(['open', 'pending', 'resolved']);
export const PriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);
export const MessageStatusEnum = z.enum(['pending', 'sent', 'failed']);
export const MessageDirectionEnum = z.enum(['inbound', 'outbound']);
export const NotificationTypeEnum = z.enum(['assignment', 'mention', 'unread']);
export const RoutingRuleStatusEnum = z.enum(['active', 'disabled']);

export const Channels = {
  TELEGRAM: 'telegram',
  IRC: 'irc',
  WHATSAPP: 'whatsapp',
  WECHAT: 'wechat',
  META: 'meta',
  X: 'x',
  EMAIL: 'email',
  SLACK: 'slack',
} as const;

export const ConversationStatuses = {
  OPEN: 'open',
  PENDING: 'pending',
  RESOLVED: 'resolved',
} as const;

export const Priorities = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

export const MessageStatuses = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export const MessageDirections = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export const NotificationTypes = {
  ASSIGNMENT: 'assignment',
  MENTION: 'mention',
  UNREAD: 'unread',
} as const;

export const RoutingRuleStatuses = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

export const parseChannel = (value: unknown) => ChannelEnum.parse(value);
export const parseConversationStatus = (value: unknown) => ConversationStatusEnum.parse(value);
export const parsePriority = (value: unknown) => PriorityEnum.parse(value);
export const parseMessageStatus = (value: unknown) => MessageStatusEnum.parse(value);
export const parseMessageDirection = (value: unknown) => MessageDirectionEnum.parse(value);
export const parseNotificationType = (value: unknown) => NotificationTypeEnum.parse(value);
export const parseRoutingRuleStatus = (value: unknown) => RoutingRuleStatusEnum.parse(value);
