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
  code: keyof typeof ERROR_CODE;
  message: string;
  details?: Record<string, any>;
}

import { ERROR_CODE } from '../constants/errors';
