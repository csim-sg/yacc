import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ApiError } from '../contracts/common/api-error';
import { errorMappingInterceptor } from './error-mapping.interceptor';

/**
 * Error-mapping interceptor spec (AC-ANG-005-3; T2 §7): every transport
 * failure leaves the chain as the typed `ApiError` (403 mapping
 * included); typed errors pass through untouched.
 */
describe('errorMappingInterceptor', () => {
  let httpClient: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorMappingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('maps a 403 with the frozen `{ error }` body onto ApiError', async () => {
    const pending = firstValueFrom(httpClient.get<unknown>('/api/users'));

    const request = http.expectOne('/api/users');
    request.flush({ error: 'Admin access required' }, { status: 403, statusText: 'Forbidden' });

    await expect(pending).rejects.toBeInstanceOf(ApiError);
    await pending.catch((error: ApiError) => {
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Admin access required');
      expect(error.body).toEqual({ error: 'Admin access required' });
    });
  });

  it('maps unparsable error bodies to `HTTP <status>`', async () => {
    const pending = firstValueFrom(httpClient.get<unknown>('/api/users'));

    const request = http.expectOne('/api/users');
    request.flush('gateway timeout', { status: 504, statusText: 'Gateway Timeout' });

    await pending.catch((error: ApiError) => {
      expect(error.statusCode).toBe(504);
      expect(error.message).toBe('HTTP 504');
    });
  });
});
