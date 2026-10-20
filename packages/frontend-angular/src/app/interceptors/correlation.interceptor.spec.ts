import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { correlationInterceptor } from './correlation.interceptor';

/**
 * Correlation interceptor spec (T2 §6): one `X-Request-ID` UUIDv4 per
 * request, distinct across requests.
 */
describe('correlationInterceptor', () => {
  let httpClient: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([correlationInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpClient = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('attaches a UUID-formatted X-Request-ID', async () => {
    const done = firstValueFrom(httpClient.get('/api/conversations'));

    const request = http.expectOne('/api/conversations');
    const correlationId = request.request.headers.get('X-Request-ID');
    expect(correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    request.flush({});
    await done;
  });

  it('generates a distinct id per request', async () => {
    const first = firstValueFrom(httpClient.get('/api/conversations'));
    const firstRequest = http.expectOne('/api/conversations');
    const second = firstValueFrom(httpClient.get('/api/conversations'));
    const secondRequest = http.expectOne('/api/conversations');

    const ids = [
      firstRequest.request.headers.get('X-Request-ID'),
      secondRequest.request.headers.get('X-Request-ID'),
    ];
    firstRequest.flush({});
    secondRequest.flush({});
    await Promise.all([first, second]);

    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });
});
