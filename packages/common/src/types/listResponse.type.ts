/**
 * List Response Interface
 * Base interface for all paginated list responses
 * Ensures consistent structure across all list endpoints
 */
export interface IListResponse<T> {
  /** Array of items for the current page */
  data: T[];
  /** Current page number (1-indexed) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Total items available */
  total?: number;
  /** Total pages available */
  pages?: number;
}
