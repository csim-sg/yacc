import type { ErrorCode } from './ErrorCode.type';

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
