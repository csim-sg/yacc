import { HttpErrorResponse } from '@angular/common/http';

/**
 * Map a failed API request onto its surfaced message: the frozen
 * `ErrorResponse` body's `error` field when present, else `HTTP <status>`
 * for HTTP failures, else the Error's message, else the given fallback
 * (React `ApiError` message semantics). Pure helper shared by
 * `AuthService` and the auth pages.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: string } | null;
    return body?.error || `HTTP ${err.status}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
