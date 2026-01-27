/**
 * Requests Index
 * Central export file for all request DTOs and interfaces
 */

// Audit Requests
export { GetConversationAuditLogsRequest } from './audit/getConversationAuditLogs.request';

// Conversations Requests
export { ListConversationsRequest, UpdateStatusRequest, UpdatePriorityRequest, AssignRequest, TagRequest } from './conversations/listConversations.request';
export { UpdateStatusRequest } from './conversations/updateStatus.request';
export { UpdatePriorityRequest } from './conversations/updatePriority.request';
export { AssignRequest } from './conversations/assign.request';
export { TagRequest } from './conversations/tag.request';

// Users Requests
export { CreateUserRequest } from './users/createUser.request';

// Auth Requests
export { AuthRequestType } from './auth/authRequest.type';

// Re-export all for convenience
export type {
  AuthRequestType,
  CreateUserRequest,
  GetConversationAuditLogsRequest,
  ListConversationsRequest,
  UpdateStatusRequest,
  UpdatePriorityRequest,
  AssignRequest,
  TagRequest,
  ISearchableRequest,
};
