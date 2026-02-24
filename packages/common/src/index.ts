/**
 * @yacc/common - Shared types, schemas, requests, and responses
 *
 * This package contains all shared types between frontend and backend
 *
 * Import patterns:
 * - Types: import type { Tag } from '@yacc/common/types/Tag.interface';
 * - Requests: import { CreateTagRequest } from '@yacc/common/requests/tags/createTag.request';
 * - Responses: import type { TagResponse } from '@yacc/common/responses/tags/tag.response';
 * - Constants: import { ConversationStatuses } from '@yacc/common/constants/statuses.constant';
 * - Schemas: import { TagSchema } from '@yacc/common/schemas/tag.schema';
 */

// Base pagination classes (SH-002)
export { BaseListRequest } from './requests/base-list.request';
export { BaseListResponse } from './responses/base-list.response';

// Re-export requests (centralized index)
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
} from './requests';

// Re-export responses (centralized index)
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
} from './responses';

// Re-export entity types (commonly used)
export type { Tag } from './types/Tag.interface';
export type { Note } from './types/note.interface';
export type { Notification } from './types/notification.interface';
export type { RoutingRule } from './types/routingRule.interface';
export type { Attachment } from './types/attachment.interface';
export type { Assignment } from './types/Assignment.type';
export type { AuditLog } from './types/AuditLog.type';
export type { BulkAction } from './types/BulkAction.type';
export type { IListResponse } from './types/listResponse.type';
export type { Timestamp } from './types/Timestamp.interface';

// Re-export supporting types
export type { RuleCondition } from './types/RuleCondition.interface';
export type { RuleAction } from './types/RuleAction.interface';
export type { RuleConditionField, RuleConditionOperator } from './types/RuleConditionType.type';
export type { RuleActionType } from './types/RuleActionType.type';
export type { BulkActionType } from './types/BulkActionType.type';
export type { RoutingRuleStatus } from './types/RoutingRuleStatus.type';
export type { NotificationType } from './types/NotificationType.type';
export type { User } from './types/User.interface';
export type { Message } from './types/Message.interface';
export type { Conversation } from './types/conversation.interface';
export type { Platform } from './types/platform.type';
export type { Channel } from './types/Channel.type';
export type { Priority } from './types/Priority.type';
export type { ConversationStatus } from './types/ConversationStatus.type';
export type { MessageStatus } from './types/MessageStatus.type';
export type { MessageDirection } from './types/MessageDirection.type';
export type { Role } from './types/Role.type';

// Re-export constants
export {
  Channels,
  ConversationStatuses,
  Priorities,
  MessageStatuses,
  MessageDirections,
  NotificationTypes,
  RoutingRuleStatuses,
  ChannelEnum,
  ConversationStatusEnum,
  PriorityEnum,
  MessageStatusEnum,
  MessageDirectionEnum,
  NotificationTypeEnum,
  RoutingRuleStatusEnum,
  parseChannel,
  parseConversationStatus,
  parsePriority,
  parseMessageStatus,
  parseMessageDirection,
  parseNotificationType,
  parseRoutingRuleStatus,
} from './constants/statuses.constant';

export {
  RuleConditionFields,
  RuleConditionOperators,
  RuleActionTypes,
  RuleConditionFieldEnum,
  RuleConditionOperatorEnum,
  RuleActionTypeEnum,
  parseRuleConditionField,
  parseRuleConditionOperator,
  parseRuleActionType,
} from './constants/routingRules.constant';
