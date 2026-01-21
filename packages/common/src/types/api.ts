/**
 * API Request/Response Types
 * Shared between frontend and backend
 */

// ============================================
// Auth Types
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: any;  // User type imported from entities
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
  channel?: any;  // Channel type from constants
  assignedUserId?: string;
  status?: any;  // ConversationStatus from constants
  priority?: any;  // Priority from constants
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateConversationResponse {
  conversation: any;  // Conversation type
}

export interface UpdateConversationRequest {
  status?: any;  // ConversationStatus from constants
  priority?: any;  // Priority from constants
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
    status?: any;  // ConversationStatus
    priority?: any;  // Priority
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
  status?: any;  // RoutingRuleStatus
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
  channel?: any;  // Channel
  tagId?: string;
  assigneeId?: string;
  status?: any;  // ConversationStatus
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
