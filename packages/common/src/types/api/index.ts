/**
 * API Types Index
 *
 * Request and response types for API communication.
 * Re-exports from requests and responses directories.
 *
 * @module @yacc/common/types/api
 * @see .docs/02-api-and-data-model.md Section 5 - REST API Endpoints
 */

// Re-export from requests index
export type {
  ForgotPasswordRequest,
  ResetPasswordRequest,
  GetConversationAuditLogsRequest,
  ListAuditLogsRequest,
  AssignRequest,
  BulkActionRequest,
  ListConversationsRequest,
  UpdatePriorityRequest,
  UpdateStatusRequest,
  TagRequest,
  CreateNoteRequest,
  ListNotesRequest,
  MarkNotificationAsReadRequest,
  ListNotificationsRequest,
  CreateRoutingRuleRequest,
  UpdateRoutingRuleRequest,
  ToggleRoutingRuleRequest,
  ListRoutingRulesRequest,
  CreateTagRequest,
  AddTagToConversationRequest,
  CreateUserRequest,
  SendMessageRequest,
  ListMessagesRequest,
  CreateIntegrationRequest,
  UpdateIntegrationRequest,
  ListIntegrationsRequest,
} from '../../requests';

// Re-export from responses index
export type {
  ForgotPasswordResponse,
  ResetPasswordResponse,
  AuditLogResponse,
  AssignmentResponse,
  BulkActionResponse,
  BulkActionResponseData,
  BulkActionFailure,
  ConversationResponse,
  NoteResponse,
  NotificationResponse,
  RoutingRuleResponse,
  TagResponse,
  UserResponse,
} from '../../responses';

// Base pagination types
export { BaseListRequest } from '../../requests/base-list.request';
export { BaseListResponse } from '../../responses/base-list.response';
