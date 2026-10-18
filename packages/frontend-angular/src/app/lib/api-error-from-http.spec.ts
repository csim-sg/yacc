import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { ApiError } from '../contracts/common/api-error';
import { apiErrorFromHttpError } from './api-error-from-http';

/**
 * Typed-error mapping spec (T2 §7): the frozen error-body shapes map onto
 * `ApiError`; timeouts and unknown failures carry status 0.
 */
describe('apiErrorFromHttpError', () => {
  it('maps the frozen `{ error }` body shape', () => {
    const response = new HttpErrorResponse({
      status: 403,
      error: { error: 'Forbidden' },
    });

    const mapped = apiErrorFromHttpError(response);

    expect(mapped).toBeInstanceOf(ApiError);
    expect(mapped.statusCode).toBe(403);
    expect(mapped.message).toBe('Forbidden');
    expect(mapped.body).toEqual({ error: 'Forbidden' });
  });

  it('maps the typed `{ code, message }` body shape', () => {
    const response = new HttpErrorResponse({
      status: 422,
      error: { code: 'VALIDATION', message: 'Invalid payload' },
    });

    const mapped = apiErrorFromHttpError(response);

    expect(mapped.statusCode).toBe(422);
    expect(mapped.message).toBe('Invalid payload');
  });

  it('falls back to `HTTP <status>` for unparsable bodies', () => {
    const response = new HttpErrorResponse({ status: 500, error: 'boom' });

    const mapped = apiErrorFromHttpError(response);

    expect(mapped.statusCode).toBe(500);
    expect(mapped.message).toBe('HTTP 500');
    expect(mapped.body).toBeNull();
  });

  it('maps timeout failures onto a status-0 ApiError', () => {
    const mapped = apiErrorFromHttpError(new TimeoutError());

    expect(mapped.statusCode).toBe(0);
    expect(mapped.message).toBe('Request timeout');
  });

  it('passes an already-typed ApiError through unchanged', () => {
    const original = new ApiError(404, 'Not found');

    expect(apiErrorFromHttpError(original)).toBe(original);
  });

  it('wraps unknown rejections as status-0 request failures', () => {
    expect(apiErrorFromHttpError('nope').message).toBe('Request failed');
    expect(apiErrorFromHttpError(new Error('socket closed')).message).toBe('socket closed');
  });
});
