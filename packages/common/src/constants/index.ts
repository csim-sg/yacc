/**
 * Constants Index
 *
 * Re-exports all application constants (enums, status values, error codes).
 * These constants provide type-safe values used across frontend and backend.
 *
 * @module @yacc/common/constants
 */

// Error codes
export { ERROR_CODE, ERROR_MESSAGE } from './errors';
export type { ErrorCode } from './errors';
export { ErrorCodeEnum, ErrorCodes, ErrorMessages, parseErrorCode } from './errors.constant';

// Roles and permissions
export {
  RoleEnum,
  UserStatusEnum,
  Roles,
  UserStatuses,
  RolePermissions,
  parseRole,
  parseUserStatus,
} from './roles.constant';

// Routing rules
export {
  RuleConditionFieldEnum,
  RuleConditionOperatorEnum,
  RuleActionTypeEnum,
  RuleConditionFields,
  RuleConditionOperators,
  RuleActionTypes,
  parseRuleConditionField,
  parseRuleConditionOperator,
  parseRuleActionType,
} from './routingRules.constant';

// Statuses
export {
  ChannelEnum,
  ConversationStatusEnum,
  PriorityEnum,
  MessageStatusEnum,
  MessageDirectionEnum,
  NotificationTypeEnum,
  RoutingRuleStatusEnum,
  Channels,
  ConversationStatuses,
  Priorities,
  MessageStatuses,
  MessageDirections,
  NotificationTypes,
  RoutingRuleStatuses,
  parseChannel,
  parseConversationStatus,
  parsePriority,
  parseMessageStatus,
  parseMessageDirection,
  parseNotificationType,
  parseRoutingRuleStatus,
} from './statuses.constant';
