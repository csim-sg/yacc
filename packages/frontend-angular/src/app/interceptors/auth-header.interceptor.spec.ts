import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { TokenStorageService } from '../services/token-storage.service';
import { authHeaderInterceptor } from './auth-header.interceptor';
import { HTTP_BYPASS_AUTH } from './http-context';

/**
 * Auth-header interceptor spec (T2 §3.5): Bearer attached from the
 * `TokenStorageService` when stored, absent otherwise, and skipped for
 * `HTTP_BYPASS_AUTH` requests (the refresh calls stay bare).
 */
describe('authHeaderInterceptor', () => {
  let httpClient: HttpClient;
  let http: HttpTestingController;
  let tokens: TokenStorageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authHeaderInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStorageService);
  });

  afterEach(() => http.verify());

  it('attaches the stored bearer token', async () => {
    tokens.setTokens('access-1', 'refresh-1', 'local');

    const done = firstValueFrom(httpClient.get('/api/conversations'));
    const request = http.expectOne('/api/conversations');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush({});
    await done;
  });

  it('sends no Authorization header without a stored token', async () => {
    const done = firstValueFrom(httpClient.get('/api/conversations'));
    const request = http.expectOne('/api/conversations');
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush({});
    await done;
  });

  it('stays bare for HTTP_BYPASS_AUTH requests even with a token', async () => {
    tokens.setTokens('access-1', 'refresh-1', 'local');

    const context = new HttpContext().set(HTTP_BYPASS_AUTH, true);
    const done = firstValueFrom(httpClient.get('/api/auth/refresh-token', { context }));
    const request = http.expectOne('/api/auth/refresh-token');
    expect(request.request.headers.get('Authorization')).toBeNull();
    request.flush({});
    await done;
  });
});
