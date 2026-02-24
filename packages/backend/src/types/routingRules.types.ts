/**
 * Routing Rules Types
 * Backend-specific DTOs and types for routing rule CRUD and evaluation
 *
 * For shared types, use:
 * - RoutingRule from '@yacc/common/types/routingRule.interface'
 * - RuleCondition from '@yacc/common/types/RuleCondition.interface'
 * - RuleAction from '@yacc/common/types/RuleAction.interface'
 * - RoutingRuleResponse from '@yacc/common/responses/rules/routingRule.response'
 * - CreateRoutingRuleRequest from '@yacc/common/requests/routing-rules/createRoutingRule.request'
 * - UpdateRoutingRuleRequest from '@yacc/common/requests/routing-rules/updateRoutingRule.request'
 */

/**
 * Condition types for rule evaluation
 * @deprecated Use RuleCondition from '@yacc/common/types/RuleCondition.interface'
 */
export interface RoutingCondition {
  field: 'channel' | 'keyword' | 'sender' | 'tag' | 'time';
  operator: 'eq' | 'contains' | 'regex' | 'has' | 'gt' | 'lt';
  value: string | number;
}

/**
 * Action types for rule evaluation
 * @deprecated Use RuleAction from '@yacc/common/types/RuleAction.interface'
 */
export interface RoutingAction {
  type: 'assign' | 'tag' | 'priority';
  value: string; // user UUID for assign, tag UUID for tag, priority string for priority
}

/**
 * Request body for creating a routing rule
 * @deprecated Use CreateRoutingRuleRequest from '@yacc/common/requests/routing-rules/createRoutingRule.request'
 */
export interface CreateRoutingRuleRequest {
  name: string;
  description?: string;
  status: 'active' | 'disabled';
  priority: number; // Lower = higher priority
  conditions: RoutingCondition[];
  actions: RoutingAction[];
}

/**
 * Request body for updating a routing rule
 * @deprecated Use UpdateRoutingRuleRequest from '@yacc/common/requests/routing-rules/updateRoutingRule.request'
 */
export interface UpdateRoutingRuleRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'disabled';
  priority?: number;
  conditions?: RoutingCondition[];
  actions?: RoutingAction[];
}

/**
 * Request body for evaluating rules (internal use)
 */
export interface RuleEvaluationContext {
  conversationId: string;
  messageId: string;
  senderEmail?: string;
  channel: string;
  body: string;
  timestamp?: Date;
}

/**
 * Result of a successful rule match
 */
export interface RuleMatchResult {
  ruleId: string;
  matchedConditions: RoutingCondition[];
  appliedActions: RoutingAction[];
}
