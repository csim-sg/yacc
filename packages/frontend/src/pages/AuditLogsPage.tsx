/**
 * Audit Logs Page
 * View and export audit logs with filtering
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { auditLogsService } from '../services/auditLogs.service';
import { useAuthStore } from '../stores/auth.store';

export function AuditLogsPage() {
  const { user } = useAuthStore();
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    dateFrom: '',
    dateTo: '',
  });
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch audit logs
  const { data: logsData, isLoading } = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: () =>
      auditLogsService.query({
        ...filters,
        page,
        limit: 20,
      }),
  });

  const logs = logsData?.data || [];
  const total = logsData?.total || 0;
  const pageSize = logsData?.pageSize || 20;
  const totalPages = useMemo(() => Math.ceil(total / pageSize), [total, pageSize]);

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await auditLogsService.export(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Check admin role
  const isAdmin =
    user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'manager';

  if (!isAdmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-base-200">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-error">Access Denied</h2>
            <p>You don't have permission to view audit logs.</p>
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
          <h2 className="text-2xl font-bold">Audit Logs</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Filters Card */}
          <div className="card bg-base-100 shadow-lg mb-6">
            <div className="card-body">
              <h3 className="card-title mb-4">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="label">
                    <span className="label-text">Action</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., ASSIGN, TAG, NOTE_CREATE"
                    className="input input-bordered input-sm w-full"
                    value={filters.action}
                    onChange={(e) =>
                      setFilters({ ...filters, action: e.target.value })
                    }
                    data-testid="filter-action"
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">Entity Type</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., CONVERSATION"
                    className="input input-bordered input-sm w-full"
                    value={filters.entityType}
                    onChange={(e) =>
                      setFilters({ ...filters, entityType: e.target.value })
                    }
                    data-testid="filter-entity-type"
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">From Date</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={filters.dateFrom}
                    onChange={(e) =>
                      setFilters({ ...filters, dateFrom: e.target.value })
                    }
                    data-testid="filter-date-from"
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">To Date</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={filters.dateTo}
                    onChange={(e) =>
                      setFilters({ ...filters, dateTo: e.target.value })
                    }
                    data-testid="filter-date-to"
                  />
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={handleExport}
                  disabled={isExporting || total === 0}
                  className="btn btn-sm btn-primary"
                  data-testid="export-button"
                >
                  {isExporting ? 'Exporting...' : 'Export to CSV'}
                </button>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h3 className="card-title mb-4">
                Audit Logs
                <span className="badge badge-lg ml-2">{total}</span>
              </h3>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="loading loading-spinner loading-lg"></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8 text-base-content/50">
                  No audit logs found
                </div>
              ) : (
                <>
                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="table table-compact w-full">
                      <thead>
                        <tr>
                          <th>Actor</th>
                          <th>Action</th>
                          <th>Entity Type</th>
                          <th>Entity ID</th>
                          <th>Timestamp</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} data-testid={`log-row-${log.id}`}>
                            <td className="font-semibold">{log.actorName}</td>
                            <td>
                              <span className="badge badge-sm badge-primary">
                                {log.action}
                              </span>
                            </td>
                            <td>{log.entityType}</td>
                            <td className="font-mono text-xs">{log.entityId}</td>
                            <td className="text-xs text-base-content/70">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td>
                              <details className="dropdown">
                                <summary className="btn btn-xs btn-ghost">
                                  View
                                </summary>
                                <div className="dropdown-content menu bg-base-200 rounded-box w-52 p-2 shadow">
                                  <pre className="text-xs overflow-auto max-h-48">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-6 pt-4 border-t">
                      <div className="text-sm text-base-content/70">
                        Page {page} of {totalPages} ({total} total)
                      </div>
                      <div className="join">
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="join-item btn btn-sm"
                          data-testid="prev-page"
                        >
                          ← Prev
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const pageNum = i + 1;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={`join-item btn btn-sm ${
                                pageNum === page ? 'btn-active' : ''
                              }`}
                              data-testid={`page-${pageNum}`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          disabled={page === totalPages}
                          className="join-item btn btn-sm"
                          data-testid="next-page"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
