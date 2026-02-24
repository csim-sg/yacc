/**
 * Bulk Action Failure
 * Details about a failed bulk operation on a specific conversation
 */
export interface BulkActionFailure {
  /** UUID of the conversation that failed */
  id: string;
  /** Reason for the failure */
  reason: string;
}

/**
 * Bulk Action Response Data
 * Inner response data for bulk action operations
 *
 * @see POST /api/conversations/bulk
 */
export interface BulkActionResponseData {
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  failureCount: number;
  /** Details of failures (if any) */
  failures: BulkActionFailure[];
}

/**
 * Bulk Action Response
 * Full response wrapper for bulk action operations
 *
 * Features:
 * - Best-effort: partial success is OK
 * - Returns detailed failure reasons
 *
 * @see POST /api/conversations/bulk
 */
export interface BulkActionResponse {
  data: BulkActionResponseData;
}
