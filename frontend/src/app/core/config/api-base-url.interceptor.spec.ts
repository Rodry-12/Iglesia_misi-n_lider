import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
  withNoXsrfProtection,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore } from '../auth/auth.store';
import { authInterceptor } from '../auth/auth.interceptor';
import {
  API_BASE_URL,
  apiBaseUrlInterceptor,
  normalizeApiBaseUrl,
} from './api-base-url.interceptor';

describe('020: configurable API destination with authentication', () => {
  const base = 'https://api.example.org/api/v1';
  const auth = { expireSession: vi.fn() };
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    auth.expireSession.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([authInterceptor, apiBaseUrlInterceptor]),
          withNoXsrfProtection(),
        ),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: base },
        { provide: AuthStore, useValue: auth },
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('routes session and list queries to the configured API with cookies', () => {
    client.get('/api/v1/auth/session').subscribe();
    const session = http.expectOne(base + '/auth/session');
    expect(session.request.withCredentials).toBe(true);
    session.flush({});
    client.get('/api/v1/people', { params: { page: 2, search: 'María' } }).subscribe();
    const list = http.expectOne((r) => r.url === base + '/people');
    expect(list.request.params.get('page')).toBe('2');
    expect(list.request.params.get('search')).toBe('María');
    list.flush({});
  });

  it('fetches CSRF at the same configured API before a protected write', () => {
    client.post('/api/v1/people', { firstName: 'María' }).subscribe();
    const csrf = http.expectOne(base + '/auth/csrf');
    expect(csrf.request.withCredentials).toBe(true);
    csrf.flush({ token: 'test-csrf', headerName: 'X-XSRF-TOKEN' });
    const write = http.expectOne(base + '/people');
    expect(write.request.headers.get('X-XSRF-TOKEN')).toBe('test-csrf');
    expect(write.request.withCredentials).toBe(true);
    expect(write.request.body).toEqual({ firstName: 'María' });
    write.flush({});
  });

  it('does not rewrite EmailJS or send it cookies or CSRF', () => {
    const url = 'https://api.emailjs.com/api/v1.0/email/send';
    client.post(url, {}).subscribe();
    const external = http.expectOne(url);
    expect(external.request.withCredentials).toBe(false);
    expect(external.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    external.flush({});
  });

  it('preserves session expiration on resource 401 and excludes failed login', () => {
    client.get('/api/v1/people').subscribe({ error: () => {} });
    http.expectOne(base + '/people').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.expireSession).toHaveBeenCalledTimes(1);
    client.post('/api/v1/auth/login', {}).subscribe({ error: () => {} });
    http.expectOne(base + '/auth/csrf').flush({ token: 'test', headerName: 'X-XSRF-TOKEN' });
    http.expectOne(base + '/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.expireSession).toHaveBeenCalledTimes(1);
  });

  it('keeps the development proxy and same-origin destination unchanged', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiBaseUrlInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    client.get('/api/v1/branches').subscribe();
    http.expectOne('/api/v1/branches').flush({});
  });

  it('normalizes trailing slashes on an HTTPS API base', () => {
    expect(normalizeApiBaseUrl(base + '/')).toBe(base);
  });

  it.each([
    'http://api.example.org/api/v1',
    '//api.example.org/api/v1',
    'https://user:password@api.example.org/api/v1',
    'https://api.example.org/api/v1?token=private',
    'https://api.example.org/api/v1#fragment',
    'https://api.example.org/incorrect',
    '',
  ])('rejects invalid API configuration: %s', (value) => {
    expect(() => normalizeApiBaseUrl(value)).toThrow();
  });
});
