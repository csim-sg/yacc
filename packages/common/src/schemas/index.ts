/**
 * Zod Schema Index
 *
 * Re-exports all Zod validation schemas for runtime validation.
 * Use these schemas for request validation in backend controllers
 * and form validation in frontend.
 *
 * @module @yacc/common/schemas
 * @see ADR-020: Zod Schema as Source of Truth
 *
 * @example
 * ```typescript
 * import { LoginRequestSchema } from '@yacc/common/schemas';
 * import { TagSchema } from '@yacc/common/schemas';
 *
 * // Validate login request
 * const validated = LoginRequestSchema.parse({ email: '...', password: '...' });
 *
 * // Infer type from schema
 * type LoginInput = z.infer<typeof LoginRequestSchema>;
 * ```
 */

// =============================================================================
// PATH PARAMETER SCHEMAS
// =============================================================================
export {
  UuidParamsSchema,
  ConversationParamsSchema,
  MessageParamsSchema,
  UserParamsSchema,
  TagParamsSchema,
  NoteParamsSchema,
  NotificationParamsSchema,
  RoutingRuleParamsSchema,
  IntegrationParamsSchema,
  AttachmentParamsSchema,
  IrcProfileParamsSchema,
  type UuidParams,
  type ConversationParams,
  type MessageParams,
  type UserParams,
  type TagParams,
  type NoteParams,
  type NotificationParams,
  type RoutingRuleParams,
  type IntegrationParams,
  type AttachmentParams,
  type IrcProfileParams,
} from './params.schema';

// =============================================================================
// AUTHENTICATION SCHEMAS
// =============================================================================
export {
  LoginRequestSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  type LoginRequest,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
} from './auth.schema';

// Password schema (for password validation)
export { PASSWORD_SCHEMA } from './passwordReset.schema';

// =============================================================================
// USER SCHEMAS
// =============================================================================
export {
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  ChangeUserRoleRequestSchema,
  ListUsersQuerySchema,
  type CreateUserRequest,
  type UpdateUserRequest,
  type ChangeUserRoleRequest,
  type ListUsersQuery,
} from './user.schema';

// =============================================================================
// CONVERSATION SCHEMAS
// =============================================================================
export {
  ListConversationsQuerySchema,
  CreateConversationRequestSchema,
  UpdateConversationRequestSchema,
  UpdateStatusRequestSchema,
  UpdatePriorityRequestSchema,
  AssignConversationRequestSchema,
  BulkUpdateConversationsRequestSchema,
  BulkAssignConversationsRequestSchema,
  SearchConversationsQuerySchema,
  type ListConversationsQuery,
  type CreateConversationRequest,
  type UpdateConversationRequest,
  type UpdateStatusRequest,
  type UpdatePriorityRequest,
  type AssignConversationRequest,
  type BulkUpdateConversationsRequest,
  type BulkAssignConversationsRequest,
  type SearchConversationsQuery,
} from './conversation.schema';

// Legacy exports for backward compatibility
export { GetConversationsQuerySchema } from './getConversationsQuery.schema';
export { ConversationFilterSchema } from './conversationFilter.schema';

// =============================================================================
// MESSAGE SCHEMAS
// =============================================================================
export {
  SendMessageRequestSchema,
  ListMessagesQuerySchema,
  GetMessagesQuerySchema,
  type SendMessageRequest,
  type ListMessagesQuery,
  type GetMessagesQuery,
} from './message.schema';

// =============================================================================
// TAG SCHEMAS
// =============================================================================
export {
  TagSchema,
  CreateTagRequestSchema,
  UpdateTagRequestSchema,
  AddTagRequestSchema,
  ListTagsQuerySchema,
  type Tag,
  type CreateTagRequest,
  type UpdateTagRequest,
  type AddTagRequest,
  type ListTagsQuery,
} from './tag.schema';

// =============================================================================
// NOTE SCHEMAS
// =============================================================================
export {
  NoteSchema,
  CreateNoteRequestSchema,
  UpdateNoteRequestSchema,
  ListNotesQuerySchema,
  type Note,
  type CreateNoteRequest,
  type UpdateNoteRequest,
  type ListNotesQuery,
} from './note.schema';

// =============================================================================
// NOTIFICATION SCHEMAS
// =============================================================================
export {
  NotificationSchema,
  ListNotificationsQuerySchema,
  MarkNotificationsReadRequestSchema,
  DismissNotificationRequestSchema,
  type Notification,
  type ListNotificationsQuery,
  type MarkNotificationsReadRequest,
  type DismissNotificationRequest,
} from './notification.schema';

// Legacy filter export
export { NotificationFilterSchema } from './notificationFilter.schema';

// =============================================================================
// ROUTING RULE SCHEMAS
// =============================================================================
export {
  RuleConditionSchema,
  RuleActionSchema,
  RoutingRuleSchema,
  CreateRoutingRuleRequestSchema,
  UpdateRoutingRuleRequestSchema,
  TestRoutingRuleRequestSchema,
  ListRoutingRulesQuerySchema,
  type RuleCondition,
  type RuleAction,
  type RoutingRule,
  type CreateRoutingRuleRequest,
  type UpdateRoutingRuleRequest,
  type TestRoutingRuleRequest,
  type ListRoutingRulesQuery,
} from './routing-rule.schema';

// Legacy exports
export { RoutingRuleExecutionSchema } from './routingRuleExecution.schema';

// =============================================================================
// BULK ACTION SCHEMAS
// =============================================================================
export { BulkActionRequestSchema } from './bulkActionRequest.schema';

// =============================================================================
// ATTACHMENT SCHEMAS
// =============================================================================
export {
  AttachmentSchema,
  UploadAttachmentRequestSchema,
  ListAttachmentsQuerySchema,
  type Attachment,
  type UploadAttachmentRequest,
  type ListAttachmentsQuery,
} from './attachment.schema';

export { FileUploadSchema } from './fileUpload.schema';

// =============================================================================
// AUDIT LOG SCHEMAS
// =============================================================================
export {
  AuditLogSchema,
  ListAuditLogsQuerySchema,
  ExportAuditLogsRequestSchema,
  type AuditLog,
  type ListAuditLogsQuery,
  type ExportAuditLogsRequest,
} from './audit-log.schema';

// =============================================================================
// INTEGRATION SCHEMAS
// =============================================================================
export {
  IntegrationSchema,
  CreateIntegrationRequestSchema,
  UpdateIntegrationRequestSchema,
  TestConnectionRequestSchema,
  ListIntegrationsQuerySchema,
  type Integration,
  type CreateIntegrationRequest,
  type UpdateIntegrationRequest,
  type TestConnectionRequest,
  type ListIntegrationsQuery,
} from './integration.schema';

// =============================================================================
// OTHER SCHEMAS
// =============================================================================
export { ParticipantSchema } from './participant.schema';
export { RawPayloadSchema } from './rawPayload.schema';
