/**
 * Domain Entity Types
 * Core data models for the application
 */
import {
  USER_STATUSES,
} from '../constants';

// Add enums that don't exist in constants yet
export const NOTIFICATION_TYPES = {
  ASSIGNMENT: 'assignment',
  MENTION: 'mention',
  UNREAD: 'unread',
} as const;

export const ROUTING_RULE_STATUSES = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];
export type RoutingRuleStatus = typeof ROUTING_RULE_STATUSES[keyof typeof ROUTING_RULE_STATUSES];
export type UserStatus = typeof USER_STATUSES[keyof typeof USER_STATUSES];

// User
export interface User {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: string;  // ISO-8601
  updatedAt: string;  // ISO-8601
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
