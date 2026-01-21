/**
 * Common API Response Types
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
}
