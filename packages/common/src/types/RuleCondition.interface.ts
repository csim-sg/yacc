import type { RuleConditionField, RuleConditionOperator } from './RuleConditionType.type';

export interface RuleCondition {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string;
}
