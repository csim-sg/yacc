/**
 * Routing Rules Types
 * DTOs and types for routing rule CRUD and evaluation
 */

/**
 * Condition types for rule evaluation
 * Supports: channel (eq), keyword (contains, regex), sender (eq), tag (has), time (hour gt/lt)
 */
export interface RoutingCondition {
  field: 'channel' | 'keyword' | 'sender' | 'tag' | 'time';
  operator: 'eq' | 'contains' | 'regex' | 'has' | 'gt' | 'lt';
  value: string | number;
}

/**
 * Action types for rule evaluation
 * Supports: assign (user_id), tag (tag_id), priority (low/normal/high/urgent)
 */
export interface RoutingAction {
  type: 'assign' | 'tag' | 'priority';
  value: string; // user UUID for assign, tag UUID for tag, priority string for priority
}

/**
 * Request body for creating a routing rule
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
