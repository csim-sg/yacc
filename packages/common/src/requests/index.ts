/**
 * Request DTOs
 * Centralized exports for all request types
 *
 * Note: Import directly from subfolder for better tree-shaking:
 * import { CreateTagRequest } from '@yacc/common/requests/tags/createTag.request';
 */

// Auth (type re-exports)
export type { ForgotPasswordRequest, ResetPasswordRequest } from './passwordReset.request';

// Audit (classes)
export { GetConversationAuditLogsRequest } from './audit/getConversationAuditLogs.request';
export { ListAuditLogsRequest } from './audit/listAuditLogs.request';

// Conversations (classes)
export { AssignRequest } from './conversations/assign.request';
export { BulkActionRequest } from './conversations/bulkAction.request';
export { BulkActionData } from './conversations/bulkActionData.request';
export { ListConversationsRequest } from './conversations/listConversations.request';
export { UpdatePriorityRequest } from './conversations/updatePriority.request';
export { UpdateStatusRequest } from './conversations/updateStatus.request';
export { TagRequest } from './conversations/tag.request';

// Notes (classes)
export { CreateNoteRequest } from './notes/createNote.request';
export { ListNotesRequest } from './notes/listNotes.request';

// Notifications (classes)
export { MarkNotificationAsReadRequest } from './notifications/markNotificationAsRead.request';
export { ListNotificationsRequest } from './notifications/listNotifications.request';

// Routing Rules (classes)
export { CreateRoutingRuleRequest } from './routing-rules/createRoutingRule.request';
export { UpdateRoutingRuleRequest } from './routing-rules/updateRoutingRule.request';
export { ToggleRoutingRuleRequest } from './routing-rules/toggleRoutingRule.request';
export { ListRoutingRulesRequest } from './routing-rules/listRoutingRules.request';

// Tags (classes)
export { CreateTagRequest } from './tags/createTag.request';
export { AddTagToConversationRequest } from './tags/addTagToConversation.request';

// Users (interface - use export type)
export type { CreateUserRequest } from './users/createUser.request';

// Messages (classes)
export { SendMessageRequest } from './messages/sendMessage.request';
export { ListMessagesRequest } from './messages/listMessages.request';

// Integrations (classes)
export { CreateIntegrationRequest } from './integrations/createIntegration.request';
export { UpdateIntegrationRequest } from './integrations/updateIntegration.request';
export { ListIntegrationsRequest } from './integrations/listIntegrations.request';
