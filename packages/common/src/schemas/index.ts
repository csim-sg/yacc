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

// Authentication schemas
export { LoginRequestSchema } from './loginRequest.schema';
export { ForgotPasswordRequestSchema } from './forgotPasswordRequest.schema';
export { ResetPasswordRequestSchema } from './resetPasswordRequest.schema';
export { PASSWORD_SCHEMA } from './passwordReset.schema';

// User schemas
export { CreateUserRequestSchema } from './createUserRequest.schema';
export { UpdateUserRequestSchema } from './updateUserRequest.schema';

// Conversation schemas
export { UpdateConversationRequestSchema } from './updateConversationRequest.schema';
export { GetConversationsQuerySchema } from './getConversationsQuery.schema';
export { SearchConversationsQuerySchema } from './searchConversationsQuery.schema';
export { ConversationFilterSchema } from './conversationFilter.schema';

// Message schemas
export { SendMessageRequestSchema } from './sendMessageRequest.schema';

// Tag schemas
export { TagSchema } from './tag.schema';
export { AddTagRequestSchema } from './addTagRequest.schema';

// Note schemas
export { NoteSchema } from './note.schema';
export { CreateNoteRequestSchema } from './createNoteRequest.schema';

// Notification schemas
export { NotificationSchema } from './notification.schema';
export { NotificationFilterSchema } from './notificationFilter.schema';

// Routing rule schemas
export { CreateRoutingRuleRequestSchema } from './createRoutingRuleRequest.schema';
export { UpdateRoutingRuleRequestSchema } from './updateRoutingRuleRequest.schema';
export { RuleConditionSchema } from './RuleCondition.schema';
export { RuleActionSchema } from './RuleAction.schema';
export { RoutingRuleExecutionSchema } from './routingRuleExecution.schema';

// Collaboration schemas (exports from collaboration.schema are duplicates of other files)
export { AssignConversationRequestSchema } from './assignConversationRequest.schema';

// Bulk action schemas
export { BulkActionRequestSchema } from './bulkActionRequest.schema';

// Attachment schemas
export { AttachmentSchema } from './attachment.schema';
export { FileUploadSchema } from './fileUpload.schema';

// Audit log schemas
export { AuditLogSchema } from './auditLog.schema';

// Participant schemas
export { ParticipantSchema } from './participant.schema';

// Raw payload schemas
export { RawPayloadSchema } from './rawPayload.schema';
