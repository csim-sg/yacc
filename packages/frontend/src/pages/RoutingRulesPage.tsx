/**
 * Routing Rules Page
 * Create, edit, and manage routing rules
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { routingRulesService, type RoutingRule } from '../services/routingRules.service';

export function RoutingRulesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  // Fetch rules
  const { data: rulesData, isLoading, error: rulesError, isError: hasRulesError } = useQuery({
    queryKey: ['routing-rules'],
    queryFn: () => routingRulesService.list(),
  });

  const rules = rulesData?.data || [];

  // Fetch selected rule executions
  const { data: executionsData } = useQuery({
    queryKey: ['routing-rule-executions', selectedRuleId],
    queryFn: () =>
      selectedRuleId ? routingRulesService.getExecutions(selectedRuleId, 1, 10) : null,
    enabled: !!selectedRuleId,
  });

  // Toggle rule status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (rule: RoutingRule) => {
      const newStatus = rule.status === 'active' ? 'disabled' : 'active';
      return routingRulesService.update(rule.id, { status: newStatus });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routing-rules'] });
    },
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => routingRulesService.delete(ruleId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routing-rules'] });
      setSelectedRuleId(null);
    },
  });

  // Check admin role (admin+ only)
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  if (!isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-base-200">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-error">Access Denied</h2>
            <p>You don't have permission to manage routing rules.</p>
            <div className="card-actions justify-end">
              <Link to="/" className="btn btn-primary">
                Go Back
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-base-200">
      {/* Header */}
      <div className="navbar bg-primary text-primary-content shadow-lg sticky top-0 z-40">
        <div className="flex-1">
          <Link to="/" className="btn btn-ghost text-xl normal-case">
            ← Back
          </Link>
        </div>
        <div className="flex-none">
          <h2 className="text-2xl font-bold">Routing Rules</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rules List */}
          <div className="lg:col-span-2">
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="card-title">Active Rules</h3>
                  <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="btn btn-sm btn-primary"
                    data-testid="create-rule-button"
                  >
                    + New Rule
                  </button>
                </div>

                {isLoading ? (
                   <div className="flex justify-center py-8">
                     <div className="loading loading-spinner loading-lg"></div>
                   </div>
                 ) : hasRulesError ? (
                   <div className="alert alert-error" data-testid="rules-query-error">
                     <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                     <span>{rulesError instanceof Error ? rulesError.message : 'Failed to load routing rules'}</span>
                   </div>
                 ) : rules.length === 0 ? (
                   <div className="text-center py-8 text-base-content/50">
                     No routing rules yet
                   </div>
                 ) : (
                  <div className="space-y-3">
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`border rounded-lg p-4 cursor-pointer transition ${
                          selectedRuleId === rule.id
                            ? 'border-primary bg-primary/5'
                            : 'border-base-300 hover:border-primary'
                        }`}
                        onClick={() => setSelectedRuleId(rule.id)}
                        data-testid={`rule-item-${rule.id}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-semibold">{rule.name}</h4>
                            {rule.description && (
                              <p className="text-sm text-base-content/70 mt-1">
                                {rule.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <span
                              className={`badge ${
                                rule.status === 'active'
                                  ? 'badge-success'
                                  : 'badge-ghost'
                              }`}
                            >
                              {rule.status}
                            </span>
                            <span className="badge badge-outline">
                              Priority: {rule.priority}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 text-xs text-base-content/60 mt-3">
                          <span>
                            {rule.conditions.length} conditions
                          </span>
                          <span>•</span>
                          <span>
                            {rule.actions.length} actions
                          </span>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatusMutation.mutate(rule);
                            }}
                            className="btn btn-xs btn-outline"
                            disabled={toggleStatusMutation.isPending}
                            data-testid={`toggle-rule-${rule.id}`}
                          >
                            {rule.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteRuleMutation.mutate(rule.id);
                            }}
                            className="btn btn-xs btn-error btn-outline"
                            disabled={deleteRuleMutation.isPending}
                            data-testid={`delete-rule-${rule.id}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Details Panel */}
          <div className="lg:col-span-1">
            {showCreateForm ? (
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title text-lg">New Rule</h3>
                  <div className="alert alert-info mt-4">
                    <span>
                      Rule creation UI coming soon. Define rules in API directly.
                    </span>
                  </div>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="btn btn-sm btn-ghost mt-4"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : selectedRuleId && rules.find((r) => r.id === selectedRuleId) ? (
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  {(() => {
                    const rule = rules.find((r) => r.id === selectedRuleId);
                    if (!rule) return null;

                    return (
                      <>
                        <h3 className="card-title text-lg">{rule.name}</h3>

                        <div className="divider my-2"></div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-sm font-semibold">
                              Priority
                            </label>
                            <div className="text-lg">{rule.priority}</div>
                          </div>

                          <div>
                            <label className="text-sm font-semibold">
                              Status
                            </label>
                            <div className="text-lg capitalize">
                              {rule.status}
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-semibold">
                              Conditions ({rule.conditions.length})
                            </label>
                            <div className="text-xs bg-base-200 p-2 rounded mt-1 max-h-32 overflow-y-auto">
                              <pre>
                                {JSON.stringify(rule.conditions, null, 2)}
                              </pre>
                            </div>
                          </div>

                          <div>
                            <label className="text-sm font-semibold">
                              Actions ({rule.actions.length})
                            </label>
                            <div className="text-xs bg-base-200 p-2 rounded mt-1 max-h-32 overflow-y-auto">
                              <pre>
                                {JSON.stringify(rule.actions, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>

                        {/* Executions */}
                        {executionsData && executionsData.data.length > 0 && (
                          <div className="mt-4">
                            <label className="text-sm font-semibold">
                              Recent Executions
                            </label>
                            <div className="space-y-2 mt-2">
                              {executionsData.data.slice(0, 5).map((exec) => (
                                <div
                                  key={exec.id}
                                  className="text-xs p-2 bg-success/10 rounded"
                                  data-testid={`execution-${exec.id}`}
                                >
                                  {exec.conversationId}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body text-center text-base-content/50">
                  <p>Select a rule to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
