/**
 * Entity Types Index
 *
 * Core domain entity types used across the YACC application.
 * These represent the primary data models from the database.
 *
 * @module @yacc/common/types/entities
 * @see .docs/02-api-and-data-model.md Section 3 - Data Models
 */

// Core entities
export type { User, UserStatus } from '../User.interface';
export type { Conversation } from '../conversation.interface';
export type { Message } from '../Message.interface';
export type { Tag } from '../Tag.interface';
export type { Note } from '../note.interface';
export type { Notification } from '../notification.interface';
export type { Attachment } from '../attachment.interface';
export type { Participant } from '../Participant.interface';

// Supporting types
export type { Timestamp } from '../Timestamp.interface';
export type { Assignment } from '../Assignment.type';
export type { AuditLog } from '../AuditLog.type';
export type { BulkAction } from '../BulkAction.type';
export type { RoutingRule } from '../routingRule.interface';
export type { RuleCondition } from '../RuleCondition.interface';
export type { RuleAction } from '../RuleAction.interface';

// Enums/Types
export type { Role } from '../Role.type';
export type { Channel } from '../Channel.type';
export type { Platform } from '../platform.type';
export type { Priority } from '../Priority.type';
export type { ConversationStatus } from '../ConversationStatus.type';
export type { MessageStatus } from '../MessageStatus.type';
export type { MessageDirection } from '../MessageDirection.type';
export type { NotificationType } from '../NotificationType.type';
export type { RoutingRuleStatus } from '../RoutingRuleStatus.type';
export type { BulkActionType } from '../BulkActionType.type';
export type { RuleConditionField, RuleConditionOperator } from '../RuleConditionType.type';
export type { RuleActionType } from '../RuleActionType.type';

// Connector types
export type { IConnector } from '../iConnector.interface';
export type { ConnectorStatus } from '../connectorStatus.type';
export type { ConnectorConfig } from '../connectorConfig.type';
export type { ConnectorMessage } from '../connectorMessage.interface';
export type { ConnectionInfo } from '../connectionInfo.interface';
export type { ConnectionError } from '../connectionError.class';
export type { ConnectorEventMap } from '../connectorEventMap.type';

// IRC types
export type { IRCConnectionStatus, IRCConnectionStatusModel } from '../irc-integration.types';

// Auth types
export type { AuthSession } from '../authSession.interface';

// Message types
export type { MessageSendError } from '../messageSendError.interface';
export type { SendMessageResponse } from '../sendMessageResponse.interface';

// Queue types
export type { RetryJobData } from '../RetryJobData.interface';
