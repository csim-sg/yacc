/**
 * List Response Interface
 * Base interface for all paginated list responses
 * Ensures consistent structure across all list endpoints
 */
export interface IListResponse<T> {
  data: T[];
  page?: number;
  limit?: number;
  total?: number;
}
