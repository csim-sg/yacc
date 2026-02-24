/**
 * Response DTOs
 * Centralized exports for all response types
 *
 * Note: Import directly from subfolder for better tree-shaking:
 * import { TagResponse } from '@yacc/common/responses/tags/tag.response';
 */

// Base list response (class - generic list response wrapper)
export { BaseListResponse } from './base-list.response';

// Auth (interfaces)
export type { ForgotPasswordResponse, ResetPasswordResponse } from './passwordReset.response';

// Audit (interfaces)
export type { AuditLogResponse } from './audit/auditLog.response';

// Conversations (interfaces)
export type { AssignmentResponse } from './conversations/assignment.response';
export type { BulkActionResponse, BulkActionResponseData, BulkActionFailure } from './conversations/bulkAction.response';
export type { ConversationResponse } from './conversations/conversation.response';

// Notes (type alias)
export type { NoteResponse } from './notes/note.response';

// Notifications (type alias)
export type { NotificationResponse } from './notifications/notification.response';

// Rules (interfaces)
export type { RoutingRuleResponse } from './rules/routingRule.response';

// Tags (interfaces)
export type { TagResponse } from './tags/tag.response';

// Users (interfaces)
export type { UserResponse } from './users/user.response';
