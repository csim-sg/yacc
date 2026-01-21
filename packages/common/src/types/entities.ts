/**
 * Domain Entity Types
 * Core data models for the application
 */
import {
  ROLES,
  USER_STATUSES,
  CHANNELS,
  CONVERSATION_STATUSES,
  PRIORITY_LEVELS,
  MESSAGE_STATUSES,
  MESSAGE_DIRECTIONS,
  NOTIFICATION_TYPES,
  ROUTING_RULE_STATUSES,
  ERROR_CODE,
  ERROR_MESSAGE,
} from '../constants';

export type Role = typeof ROLES[keyof typeof ROLES];
export type UserStatus = typeof USER_STATUSES[keyof typeof USER_STATUSES];
export type Channel = typeof CHANNELS[keyof typeof CHANNELS];
export type ConversationStatus = typeof CONVERSATION_STATUSES[keyof typeof CONVERSATION_STATUSES];
export type Priority = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS];
export type MessageStatus = typeof MESSAGE_STATUSES[keyof typeof MESSAGE_STATUSES];
export type MessageDirection = typeof MESSAGE_DIRECTIONS[keyof typeof MESSAGE_DIRECTIONS];
export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
export type RoutingRuleStatus = typeof ROUTING_RULE_STATUSES[keyof typeof ROUTING_RULE_STATUSES];
export type ErrorCode = typeof ERROR_CODE[keyof typeof ERROR_CODE];

// Conversation
export interface Conversation {
  id: string;
  channel: Channel;
  externalThreadId: string;
  status: ConversationStatus;
  priority: Priority;
  assignedUserId?: string;
  assignedUser?: User;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

// Message
export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  body: string;
  status: MessageStatus;
  direction: MessageDirection;
  platformMessageId?: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

// Attachment
export interface Attachment {
  id: string;
  messageId: string;
  url: string;
  storageKey: string;
  type: string;  // MIME type
  name: string;
  size: number;
  uploadedById?: string;
  uploadedAt: string;
}

// Tag
export interface Tag {
  id: string;
  name: string;
  color: string;
  createdById: string;
  createdAt: string;
}

// Note
export interface Note {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

// Notification
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  conversationId: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  createdAt: string;
}

// Routing Rule
export interface RoutingRule {
  id: string;
  name: string;
  status: RoutingRuleStatus;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleCondition {
  field: 'channel' | 'keyword' | 'sender' | 'tag' | 'time';
  operator: 'eq' | 'in' | 'contains' | 'matches' | 'gt' | 'lt';
  value: string | string[];
}

export interface RuleAction {
  type: 'assign' | 'tag' | 'priority';
  value: string;
}

// Audit Log
export interface AuditLog {
  id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

// Raw Payload
export interface RawPayload {
  id: string;
  messageId: string;
  storageKey: string;
  createdAt: string;
  expiresAt: string;
}

// Conversation
export interface Conversation {
  id: string;
  channel: Channel;
  externalThreadId: string;
  status: ConversationStatus;
  priority: Priority;
  assignedUserId?: string;
  assignedUser?: User;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

// Message
export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  senderName?: string;
  body: string;
  status: MessageStatus;
  direction: MessageDirection;
  platformMessageId?: string;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
}

// Attachment
export interface Attachment {
  id: string;
  messageId: string;
  url: string;
  storageKey: string;
  type: string;  // MIME type
  name: string;
  size: number;
  uploadedById?: string;
  uploadedAt: string;
}

// Tag
export interface Tag {
  id: string;
  name: string;
  color: string;
  createdById: string;
  createdAt: string;
}

// Note
export interface Note {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

// Notification
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  conversationId: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  createdAt: string;
}

// Routing Rule
export interface RoutingRule {
  id: string;
  name: string;
  status: RoutingRuleStatus;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleCondition {
  field: 'channel' | 'keyword' | 'sender' | 'tag' | 'time';
  operator: 'eq' | 'in' | 'contains' | 'matches' | 'gt' | 'lt';
  value: string | string[];
}

export interface RuleAction {
  type: 'assign' | 'tag' | 'priority';
  value: string;
}

// Audit Log
export interface AuditLog {
  id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

// Raw Payload
export interface RawPayload {
  id: string;
  messageId: string;
  storageKey: string;
  createdAt: string;
  expiresAt: string;
}
