import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { apiErrorFromHttpError } from '../lib/api-error-from-http';

/**
 * Error-mapping interceptor (T2 §7; ARCH-005 §7): the outermost response
 * stage — every failure leaving the HTTP layer is the typed `ApiError`
 * (403 mapping included: the frozen error body's message is surfaced to
 * the store `error()` signals). Non-transport errors pass through
 * untouched.
 */
export const errorMappingInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => throwError(() => apiErrorFromHttpError(error))),
  );
