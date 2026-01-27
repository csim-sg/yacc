import { z } from 'zod';

export const RuleConditionFieldEnum = z.enum(['channel', 'keyword', 'sender', 'tag', 'time']);
export const RuleConditionOperatorEnum = z.enum(['eq', 'in', 'contains', 'matches', 'gt', 'lt']);
export const RuleActionTypeEnum = z.enum(['assign', 'tag', 'priority']);

export const RuleConditionFields = {
  CHANNEL: 'channel',
  KEYWORD: 'keyword',
  SENDER: 'sender',
  TAG: 'tag',
  TIME: 'time',
} as const;

export const RuleConditionOperators = {
  EQ: 'eq',
  IN: 'in',
  CONTAINS: 'contains',
  MATCHES: 'matches',
  GT: 'gt',
  LT: 'lt',
} as const;

export const RuleActionTypes = {
  ASSIGN: 'assign',
  TAG: 'tag',
  PRIORITY: 'priority',
} as const;

export const parseRuleConditionField = (value: unknown) => RuleConditionFieldEnum.parse(value);
export const parseRuleConditionOperator = (value: unknown) => RuleConditionOperatorEnum.parse(value);
export const parseRuleActionType = (value: unknown) => RuleActionTypeEnum.parse(value);
