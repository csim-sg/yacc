import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  CreateRoutingRuleRequest,
  CreateRoutingRuleResponse,
  DeleteRoutingRuleResponse,
  GetRoutingRuleResponse,
  ListRoutingRuleExecutionsParams,
  ListRoutingRuleExecutionsResponse,
  ListRoutingRulesResponse,
  UpdateRoutingRuleRequest,
  UpdateRoutingRuleResponse,
} from '../contracts/http/routing-rules.schema';
import { toHttpParams } from '../lib/http-params';
import { mutationContext } from '../interceptors/http-context';

/**
 * Routing-rules HTTP service (T2 §3.5 — mirrors the React
 * `routingRules.service.ts`; executions pagination uses `pageSize`, the
 * verified wire drift row). Owns IO only; state lives in
 * `RoutingRulesStore`.
 */
@Injectable({ providedIn: 'root' })
export class RoutingRulesService {
  private readonly baseUrl = '/api/routing-rules';
  private readonly http = inject(HttpClient);

  /** GET /api/routing-rules. */
  list(): Promise<ListRoutingRulesResponse> {
    return firstValueFrom(this.http.get<ListRoutingRulesResponse>(this.baseUrl));
  }

  /** GET /api/routing-rules/:id — `{ data: rule }`. */
  getById(ruleId: string): Promise<GetRoutingRuleResponse> {
    return firstValueFrom(
      this.http.get<GetRoutingRuleResponse>(`${this.baseUrl}/${ruleId}`),
    );
  }

  /** POST /api/routing-rules — `{ data: rule }`. */
  create(body: CreateRoutingRuleRequest): Promise<CreateRoutingRuleResponse> {
    return firstValueFrom(
      this.http.post<CreateRoutingRuleResponse>(this.baseUrl, body, {
        context: mutationContext(),
      }),
    );
  }

  /** PATCH /api/routing-rules/:id — `{ data: rule }`. */
  update(ruleId: string, body: UpdateRoutingRuleRequest): Promise<UpdateRoutingRuleResponse> {
    return firstValueFrom(
      this.http.patch<UpdateRoutingRuleResponse>(`${this.baseUrl}/${ruleId}`, body, {
        context: mutationContext(),
      }),
    );
  }

  /** DELETE /api/routing-rules/:id. */
  delete(ruleId: string): Promise<DeleteRoutingRuleResponse> {
    return firstValueFrom(
      this.http.delete<DeleteRoutingRuleResponse>(`${this.baseUrl}/${ruleId}`, {
        context: mutationContext(),
      }),
    );
  }

  /** GET /api/routing-rules/:id/executions — execution history. */
  executions(
    ruleId: string,
    params: ListRoutingRuleExecutionsParams = {},
  ): Promise<ListRoutingRuleExecutionsResponse> {
    return firstValueFrom(
      this.http.get<ListRoutingRuleExecutionsResponse>(
        `${this.baseUrl}/${ruleId}/executions`,
        { params: toHttpParams(params) },
      ),
    );
  }
}
