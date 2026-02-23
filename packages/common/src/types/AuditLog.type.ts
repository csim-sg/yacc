/**
 * Audit Log Entity
 * Immutable audit trail of all system actions
 * Retained for 1 year (configurable)
 *
 * @see GET /api/audit/logs - ListAuditLogsRequest
 * @see GET /api/audit/export - ExportAuditLogsRequest
 */
export type AuditLog = {
  /** Unique identifier (UUID) */
  id: string;
  /** UUID of the user who performed the action (null for system actions) */
  actorId: string | null;
  /** Display name of the actor (for UI display when actorId is null) */
  actorName?: string;
  /** Action type (e.g., 'assign', 'tag', 'status_change', 'rule_execution') */
  action: string;
  /** Type of entity affected (e.g., 'conversation', 'user', 'rule') */
  entityType: string;
  /** UUID of the affected entity */
  entityId: string;
  /** Additional context as JSON (action-specific metadata) */
  metadata: Record<string, unknown>;
  /** IP address of the actor (if applicable) */
  ipAddress?: string;
  /** ISO8601 timestamp when action was logged */
  createdAt: string;
};
