import type { RuleActionType } from './RuleActionType.type';

export interface RuleAction {
  type: RuleActionType;
  value: string;
}
