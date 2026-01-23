/**
 * Common API Response Types
 */

import type { ValueOf } from './utils';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface ErrorResponse {
  code: ValueOf<typeof ERROR_CODE>;
  message: string;
  details?: Record<string, any>;
}

import { ERROR_CODE } from '../constants/errors';
