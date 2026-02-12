/**
 * Routing Rules Service
 * Handles routing rules CRUD operations and executions
 */

import { api } from '../lib/apiClient';

export interface RoutingRuleCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface RoutingRuleAction {
  type: string;
  value: unknown;
}

export interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'disabled';
  priority: number;
  conditions: RoutingRuleCondition[];
  actions: RoutingRuleAction[];
  createdAt: string;
  updatedAt: string;
}

export interface RoutingRuleExecution {
  id: string;
  ruleId: string;
  conversationId: string;
  matchedConditions: RoutingRuleCondition[];
  appliedActions: RoutingRuleAction[];
  createdAt: string;
}

export interface CreateRoutingRuleRequest {
  name: string;
  description?: string;
  priority: number;
  conditions: RoutingRuleCondition[];
  actions: RoutingRuleAction[];
}

export interface UpdateRoutingRuleRequest {
  name?: string;
  description?: string;
  priority?: number;
  status?: 'active' | 'disabled';
  conditions?: RoutingRuleCondition[];
  actions?: RoutingRuleAction[];
}

export interface ListRoutingRulesResponse {
  data: RoutingRule[];
}

export interface ListRoutingRuleExecutionsResponse {
  data: RoutingRuleExecution[];
  total: number;
  page: number;
  pageSize: number;
}

export const routingRulesService = {
  /**
   * List all routing rules
   * GET /api/routing-rules
   * RBAC: manager+ only
   */
  async list(): Promise<ListRoutingRulesResponse> {
    return api.get<ListRoutingRulesResponse>('/api/routing-rules');
  },

  /**
   * Get a specific routing rule
   * GET /api/routing-rules/:id
   * RBAC: manager+ only
   */
  async getById(id: string): Promise<{ data: RoutingRule }> {
    return api.get<{ data: RoutingRule }>(`/api/routing-rules/${id}`);
  },

  /**
   * Create a new routing rule
   * POST /api/routing-rules
   * RBAC: admin+ only
   */
  async create(
    payload: CreateRoutingRuleRequest
  ): Promise<{ data: RoutingRule }> {
    return api.post<{ data: RoutingRule }>('/api/routing-rules', payload);
  },

  /**
   * Update a routing rule
   * PATCH /api/routing-rules/:id (NOT PUT)
   * RBAC: admin+ only
   */
  async update(
    id: string,
    payload: UpdateRoutingRuleRequest
  ): Promise<{ data: RoutingRule }> {
    return api.patch<{ data: RoutingRule }>(`/api/routing-rules/${id}`, payload);
  },

  /**
   * Delete a routing rule
   * DELETE /api/routing-rules/:id
   * RBAC: admin+ only
   */
  async delete(id: string): Promise<{ data: unknown }> {
    return api.delete<{ data: unknown }>(`/api/routing-rules/${id}`);
  },

  /**
   * Get execution history for a routing rule
   * GET /api/routing-rules/:id/executions?page=1&pageSize=50
   * Note: Backend uses 'pageSize' NOT 'limit' for pagination
   * RBAC: manager+ only
   */
  async getExecutions(
    ruleId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ListRoutingRuleExecutionsResponse> {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });

    return api.get<ListRoutingRuleExecutionsResponse>(
      `/api/routing-rules/${ruleId}/executions?${query}`
    );
  },
};
