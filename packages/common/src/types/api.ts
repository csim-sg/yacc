/**
 * API Request/Response Types
 * Shared between frontend and backend
 */
import {
  ROLES,
  CHANNELS,
  CONVERSATION_STATUSES,
  PRIORITY_LEVELS,
  MESSAGE_STATUSES,
  MESSAGE_DIRECTIONS,
} from '../constants';

export type Role = typeof ROLES[keyof typeof ROLES];
export type Channel = typeof CHANNELS[keyof typeof CHANNELS];
export type ConversationStatus = typeof CONVERSATION_STATUSES[keyof typeof CONVERSATION_STATUSES];
export type Priority = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS];
export type MessageStatus = typeof MESSAGE_STATUSES[keyof typeof MESSAGE_STATUSES];
export type MessageDirection = typeof MESSAGE_DIRECTIONS[keyof typeof MESSAGE_DIRECTIONS];

// ============================================
// Auth Types
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: any;  // User type from entities
  accessToken: string;
  refreshToken?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

// ============================================
// Conversation Types
// ============================================

export interface GetConversationsQuery {
  page?: number;
  pageSize?: number;
  channel?: Channel;
  assignedUserId?: string;
  status?: ConversationStatus;
  priority?: Priority;
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateConversationResponse {
  conversation: any;  // Conversation type from entities
}

export interface UpdateConversationRequest {
  status?: ConversationStatus;
  priority?: Priority;
  assignedUserId?: string;
}

// ============================================
// Message Types
// ============================================

export interface SendMessageRequest {
  body: string;
  attachments?: FileUpload[];
}

export interface FileUpload {
  name: string;
  type: string;
  size: number;
  url: string;  // CDN URL
}

// ============================================
// Collaboration Types
// ============================================

export interface AddTagRequest {
  tagId: string;
}

export interface CreateNoteRequest {
  body: string;
}

export interface AssignConversationRequest {
  assignedUserId: string;
}

export interface BulkActionRequest {
  conversationIds: string[];
  action: 'assign' | 'tag' | 'changeStatus' | 'changePriority';
  data: {
    assignedUserId?: string;
    tagId?: string;
    status?: ConversationStatus;
    priority?: Priority;
  };
}

export interface BulkActionResponse {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}

// ============================================
// Routing Rules
// ============================================

export interface CreateRoutingRuleRequest {
  name: string;
  conditions: any;  // RuleCondition[] from entities
  actions: any;  // RuleAction[] from entities
  priority: number;
}

export interface UpdateRoutingRuleRequest {
  name?: string;
  status?: any;  // RoutingRuleStatus from entities
  conditions?: any;
  actions?: any;
  priority?: number;
}

// ============================================
// Search
// ============================================

export interface SearchConversationsQuery {
  q: string;
  page?: number;
  pageSize?: number;
  channel?: Channel;
  tagId?: string;
  assigneeId?: string;
  status?: ConversationStatus;
  dateFrom?: string;
  dateTo?: string;
}

// ============================================
// Pagination & Responses
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ErrorResponse {
  code: any;  // ErrorCode from constants
  message: string;
  details?: Record<string, any>;
}
