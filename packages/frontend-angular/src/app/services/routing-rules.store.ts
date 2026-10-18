import { Injectable, inject } from '@angular/core';

import { cacheKeys } from '../contracts/cache-keys';
import type {
  CreateRoutingRuleRequest,
  ListRoutingRuleExecutionsParams,
  ListRoutingRuleExecutionsResponse,
  ListRoutingRulesResponse,
  UpdateRoutingRuleRequest,
} from '../contracts/http/routing-rules.schema';
import { ResourceState, type ResourceSnapshot } from './resource-state';
import { RoutingRulesService } from './routing-rules.service';

/**
 * Routing-rules resource store (T2 §3.1 family store): rules list and
 * execution history on `ResourceState<T>`; rule mutations invalidate the
 * rules caches. The canonical registry defines no rule-detail key, so a
 * single-rule fetch stays on `RoutingRulesService.getById` (no ad-hoc
 * keys — ANG-002 grep gate).
 */
@Injectable({ providedIn: 'root' })
export class RoutingRulesStore {
  private readonly service = inject(RoutingRulesService);
  private readonly lists = new ResourceState<ListRoutingRulesResponse>();
  private readonly executions = new ResourceState<ListRoutingRuleExecutionsResponse>();

  /** Reactive snapshot of the rules list, if loaded. */
  listSnapshot(): ResourceSnapshot<ListRoutingRulesResponse> | undefined {
    return this.lists.snapshot(cacheKeys.routingRules.all());
  }

  /** Reactive snapshot of one rule's execution history, if loaded. */
  executionsSnapshot(
    ruleId: string,
    params: ListRoutingRuleExecutionsParams = {},
  ): ResourceSnapshot<ListRoutingRuleExecutionsResponse> | undefined {
    return this.executions.snapshot([...cacheKeys.routingRules.executions(ruleId), params]);
  }

  /** Load (or refresh) the rules list. */
  async loadRules(): Promise<void> {
    try {
      await this.lists.load(cacheKeys.routingRules.all(), () => this.service.list());
    } catch {
      // State carries the error.
    }
  }

  /** Load (or refresh) one rule's execution history. */
  async loadExecutions(
    ruleId: string,
    params: ListRoutingRuleExecutionsParams = {},
  ): Promise<void> {
    try {
      await this.executions.load(
        [...cacheKeys.routingRules.executions(ruleId), params],
        () => this.service.executions(ruleId, params),
      );
    } catch {
      // State carries the error.
    }
  }

  /** POST /api/routing-rules → invalidate the rules list. */
  async createRule(body: CreateRoutingRuleRequest): Promise<void> {
    await this.service.create(body);
    this.lists.invalidate();
  }

  /** PATCH /api/routing-rules/:id → invalidate the rules list. */
  async updateRule(ruleId: string, body: UpdateRoutingRuleRequest): Promise<void> {
    await this.service.update(ruleId, body);
    this.lists.invalidate();
  }

  /** DELETE /api/routing-rules/:id → invalidate the rules list. */
  async deleteRule(ruleId: string): Promise<void> {
    await this.service.delete(ruleId);
    this.lists.invalidate();
  }
}
