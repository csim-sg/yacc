import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import type {
  ListRoutingRuleExecutionsParams,
  ListRoutingRuleExecutionsResponse,
  ListRoutingRulesResponse,
  RoutingRule,
  RoutingRuleExecution,
} from '../../contracts/http/routing-rules.schema';
import { apiErrorMessage } from '../../lib/api-error-message';
import { AuthService } from '../../services/auth.service';
import type { ResourceSnapshot } from '../../services/resource-state';
import { RoutingRulesStore } from '../../services/routing-rules.store';

/** Selected rule's executions page (React `getExecutions(id, 1, 10)` parity). */
const EXECUTIONS_PARAMS: ListRoutingRuleExecutionsParams = { page: 1, pageSize: 10 };

/** Details panel shows at most five executions (React `.slice(0, 5)` parity). */
const RECENT_EXECUTIONS_LIMIT = 5;

/**
 * Routing Rules Page (React `pages/RoutingRulesPage.tsx` port — W14).
 *
 * Rules CRUD + executions surface over the canonical store: the list rides
 * `RoutingRulesStore.loadRules`, selection loads the rule's execution
 * history (`?page=1&pageSize=10` — the verified `pageSize` wire drift row),
 * status toggle rides `updateRule({ status })` (PATCH — NOT PUT) and delete
 * rides `deleteRule`; both invalidate the rules list (React
 * `invalidateQueries(['routing-rules'])` parity). Creation stays the React
 * stub panel ("coming soon") — parity-of-absence; the typed create contract
 * is exercised by the store spec.
 *
 * RBAC (React in-component `isAdmin` parity): SUPER_ADMIN/ADMIN manage
 * rules; anyone else gets the Access-Denied card. The route additionally
 * carries `roleGuard('ADMIN')` (React `ProtectedRoute requiredRole="ADMIN"`
 * parity) — UX only, the backend `@Authorized` stays the security boundary.
 */
@Component({
  selector: 'app-routing-rules',
  imports: [RouterLink],
  templateUrl: './routing-rules.html',
})
export class RoutingRules {
  private readonly store = inject(RoutingRulesStore);
  private readonly auth = inject(AuthService);

  /** React `showCreateForm` — toggles the (stub) creation panel. */
  protected readonly showCreateForm = signal(false);

  /** React `selectedRuleId` — the details/executions selection. */
  protected readonly selectedRuleId = signal<string | null>(null);

  /** React `toggleStatusMutation.isPending` — disables every toggle button. */
  protected readonly isToggling = signal(false);

  /** React `deleteRuleMutation.isPending` — disables every delete button. */
  protected readonly isDeleting = signal(false);

  /** Rules list resource snapshot (null while the first load is pending). */
  protected readonly listSnapshot = computed<ResourceSnapshot<ListRoutingRulesResponse> | null>(
    () => this.store.listSnapshot() ?? null,
  );

  /** Loaded rule rows. */
  protected readonly rules = computed<RoutingRule[]>(() => this.listSnapshot()?.data?.data ?? []);

  /** First load with nothing to show yet (React `isLoading` parity). */
  protected readonly isLoading = computed(
    () => (this.listSnapshot()?.loading ?? false) && this.listSnapshot()?.data === undefined,
  );

  protected readonly rulesError = computed(() => this.listSnapshot()?.error ?? null);

  /** React `rulesError instanceof Error ? message : fallback` on the delivered helper. */
  protected readonly errorMessage = computed(() =>
    apiErrorMessage(this.rulesError(), 'Failed to load routing rules'),
  );

  /** In-component admin gate (React `isAdmin` parity: ADMIN or SUPER_ADMIN). */
  protected readonly isAdmin = computed<boolean>(() => {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  });

  /** Selected rule's executions snapshot (null while nothing is selected). */
  protected readonly executionsSnapshot = computed<ResourceSnapshot<ListRoutingRuleExecutionsResponse> | null>(
    () => {
      const ruleId = this.selectedRuleId();
      return ruleId !== null ? (this.store.executionsSnapshot(ruleId, EXECUTIONS_PARAMS) ?? null) : null;
    },
  );

  /** Loaded execution rows. */
  protected readonly executions = computed<RoutingRuleExecution[]>(
    () => this.executionsSnapshot()?.data?.data ?? [],
  );

  /** Selected rule still present in the loaded list (stale selection → placeholder). */
  protected readonly selectedRule = computed<RoutingRule | null>(
    () => this.rules().find((rule) => rule.id === this.selectedRuleId()) ?? null,
  );

  /** First five executions (React `slice(0, 5)` parity). */
  protected readonly recentExecutions = computed<RoutingRuleExecution[]>(
    () => this.executions().slice(0, RECENT_EXECUTIONS_LIMIT),
  );

  constructor() {
    // Mount-time list load (React `useQuery(['routing-rules'])` parity;
    // 30s-fresh repeat visits are store cache hits, TanStack parity).
    void this.store.loadRules();

    // Selection → execution-history load (React `enabled: !!selectedRuleId`
    // parity). The trigger fires once per selection; snapshot updates
    // re-render through the tracked computeds without re-fetching.
    effect(() => {
      const ruleId = this.selectedRuleId();
      if (ruleId !== null) {
        void untracked(() => {
          void this.store.loadExecutions(ruleId, EXECUTIONS_PARAMS);
        });
      }
    });
  }

  /** Row click → select (React `onClick={() => setSelectedRuleId(rule.id)}` parity). */
  protected selectRule(rule: RoutingRule): void {
    this.selectedRuleId.set(rule.id);
  }

  /** React `setShowCreateForm(!showCreateForm)` parity. */
  protected toggleCreateForm(): void {
    this.showCreateForm.update((show) => !show);
  }

  /**
   * Status toggle (React `toggleStatusMutation` parity): flip
   * active↔disabled through the store's PATCH; the store invalidates the
   * list so the row re-renders with the new badge. Failure state mirrors
   * the mutation-error path — recorded, no dedicated UI (React parity).
   */
  protected async toggleStatus(rule: RoutingRule): Promise<void> {
    const newStatus = rule.status === 'active' ? 'disabled' : 'active';
    this.isToggling.set(true);
    try {
      await this.store.updateRule(rule.id, { status: newStatus });
    } catch (err: unknown) {
      console.error('Status toggle failed:', err instanceof Error ? err.message : String(err));
    } finally {
      this.isToggling.set(false);
    }
  }

  /**
   * Delete (React `deleteRuleMutation` parity): store DELETE + list
   * invalidation; success clears the selection (stale selection would show
   * the placeholder anyway — React `setSelectedRuleId(null)` parity).
   */
  protected async deleteRule(rule: RoutingRule): Promise<void> {
    this.isDeleting.set(true);
    try {
      await this.store.deleteRule(rule.id);
      this.selectedRuleId.set(null);
    } catch (err: unknown) {
      console.error('Delete failed:', err instanceof Error ? err.message : String(err));
    } finally {
      this.isDeleting.set(false);
    }
  }

  /** Details JSON block (React `JSON.stringify(value, null, 2)` parity). */
  protected jsonPretty(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }
}
