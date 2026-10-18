import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error-message';

/**
 * api-error-message spec (ANG-004 PB-3 support) — the shared surfaced
 * error mapping (frozen `ErrorResponse` body → UI message).
 */
describe('apiErrorMessage', () => {
  function httpError(status: number, body: unknown): HttpErrorResponse {
    return new HttpErrorResponse({ status, error: body });
  }

  it('surfaces the frozen `{ error }` body field', () => {
    expect(apiErrorMessage(httpError(401, { error: 'Invalid credentials' }), 'fallback')).toBe(
      'Invalid credentials'
    );
  });

  it('falls back to the HTTP status when the body carries no message', () => {
    expect(apiErrorMessage(httpError(500, null), 'fallback')).toBe('HTTP 500');
    expect(apiErrorMessage(httpError(500, {}), 'fallback')).toBe('HTTP 500');
  });

  it('uses an Error message outside HTTP failures', () => {
    expect(apiErrorMessage(new Error('network down'), 'fallback')).toBe('network down');
  });

  it('uses the caller fallback for unknown values', () => {
    expect(apiErrorMessage(undefined, 'Password change failed')).toBe('Password change failed');
  });
});
