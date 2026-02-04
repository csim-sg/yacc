/**
 * Database Schema (Re-exports)
 *
 * This file re-exports all schema tables from individual schema files.
 * Individual schemas are located in packages/backend/src/schemas/
 *
 * Follows ADR-005: Infrastructure folder for schema re-exports
 */

// User & Auth
export {
  users,
  userRoleEnum,
  userStatusEnum,
  type User,
  type UserInsert,
} from '../schemas/user.schema';

export {
  passwordResetTokens,
  type PasswordResetToken,
  type PasswordResetTokenInsert,
} from '../schemas/passwordReset.schema';

export {
  session,
  verification,
  account,
  type Session,
  type SessionInsert,
  type Verification,
  type VerificationInsert,
  type Account,
  type AccountInsert,
} from '../schemas/betterAuth.schema';

// Conversations & Messages
export {
  conversations,
  conversationStatusEnum,
  conversationPriorityEnum,
  channelTypeEnum,
  type Conversation,
  type ConversationInsert,
} from '../schemas/conversation.schema';

export {
  messages,
  messageStatusEnum,
  messageDirectionEnum,
  type Message,
  type MessageInsert,
} from '../schemas/message.schema';

// Collaboration
export {
  tags,
  conversationTags,
  type Tag,
  type TagInsert,
  type ConversationTag,
  type ConversationTagInsert,
} from '../schemas/tag.schema';

export {
  notes,
  type Note,
  type NoteInsert,
} from '../schemas/note.schema';

// Notifications
export {
  notifications,
  type Notification,
  type NotificationInsert,
} from '../schemas/notification.schema';

// Routing & Rules
export {
  routingRules,
  routingRuleExecutions,
  type RoutingRule,
  type RoutingRuleInsert,
  type RoutingRuleExecution,
  type RoutingRuleExecutionInsert,
} from '../schemas/routingRule.schema';

// Audit & Payloads
export {
  auditLogs,
  type AuditLog,
  type AuditLogInsert,
} from '../schemas/auditLog.schema';

export {
  rawPayloads,
  type RawPayload,
  type RawPayloadInsert,
} from '../schemas/rawPayload.schema';

export {
  attachments,
  type Attachment,
  type AttachmentInsert,
} from '../schemas/attachment.schema';
