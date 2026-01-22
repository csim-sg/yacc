import type { RuleConditionField } from './RuleConditionField.type';
import type { RuleConditionOperator } from './RuleConditionOperator.type';

export interface RuleCondition {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string | string[];
}
