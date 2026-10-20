import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { ApiError } from '../contracts/common/api-error';
import { ErrorEnvelopeSchema } from '../contracts/common/error.schema';

/**
 * Map a transport-level failure onto the typed `ApiError` (T2 §7; ARCH-005
 * §7). The interceptor chain is the ONLY place `HttpErrorResponse` is
 * translated — stores and components consume `ApiError` exclusively.
 *
 * Message semantics (React `toApiError` parity): the frozen error body's
 * `error` field when present, its `message` field for the typed
 * `{code,message}` shape, else `HTTP <status>`; timeouts and network-level
 * failures carry status 0.
 */
export function apiErrorFromHttpError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof TimeoutError) {
    return new ApiError(0, 'Request timeout');
  }
  if (error instanceof HttpErrorResponse) {
    const parsed = ErrorEnvelopeSchema.safeParse(error.error);
    if (parsed.success) {
      const body = parsed.data;
      if ('error' in body) {
        return new ApiError(error.status, body.error, body);
      }
      return new ApiError(error.status, body.message, body);
    }
    return new ApiError(error.status, `HTTP ${error.status}`, null);
  }
  if (error instanceof Error) {
    return new ApiError(0, error.message);
  }
  return new ApiError(0, 'Request failed');
}
