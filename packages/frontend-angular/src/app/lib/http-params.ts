import { HttpParams } from '@angular/common/http';

/**
 * Serialize defined params onto a query string (React `buildQueryString`
 * parity: undefined/null/'' skipped). Pure helper shared by the family
 * HTTP services.
 */
export function toHttpParams(params: Record<string, unknown>): HttpParams {
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    httpParams = httpParams.set(key, String(value));
  }
  return httpParams;
}
