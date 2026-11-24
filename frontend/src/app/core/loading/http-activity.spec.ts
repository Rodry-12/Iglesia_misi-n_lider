import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { retry } from 'rxjs';
import { HttpActivity } from './http-activity';
import { httpActivityInterceptor, SKIP_HTTP_ACTIVITY } from './http-activity.interceptor';
import { authInterceptor } from '../auth/auth.interceptor';
import { AuthStore } from '../auth/auth.store';

describe('actividad HTTP centralizada', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let activity: HttpActivity;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpActivityInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { expireSession: vi.fn(), denyAccess: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    activity = TestBed.inject(HttpActivity);
  });
  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('espera todas las peticiones concurrentes y no altera sus resultados', () => {
    let result: unknown;
    client.get('/api/v1/branches').subscribe((value) => (result = value));
    client.get('/api/v1/roles').subscribe();
    expect(activity.busy()).toBe(true);
    http.expectOne('/api/v1/branches').flush({ items: [] });
    expect(result).toEqual({ items: [] });
    expect(activity.busy()).toBe(true);
    http.expectOne('/api/v1/roles').flush([]);
    expect(activity.busy()).toBe(false);
  });

  it('limpia el contador ante error y cancelación sin cerrar otra petición', () => {
    const pending = client.get('/api/v1/branches').subscribe();
    client.get('/api/v1/roles').subscribe({ error: () => {} });
    http.expectOne('/api/v1/roles').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(activity.busy()).toBe(true);
    const canceled = http.expectOne('/api/v1/branches');
    pending.unsubscribe();
    expect(canceled.cancelled).toBe(true);
    expect(activity.busy()).toBe(false);
  });

  it('cubre la preparación CSRF y la escritura sin quedar activo al terminar', () => {
    client.post('/api/v1/branches', {}).subscribe();
    expect(activity.busy()).toBe(true);
    http.expectOne('/api/v1/auth/csrf').flush({ token: 'synthetic', headerName: 'X-XSRF-TOKEN' });
    expect(activity.busy()).toBe(true);
    const write = http.expectOne('/api/v1/branches');
    expect(write.request.headers.get('X-XSRF-TOKEN')).toBe('synthetic');
    write.flush({}, { status: 201, statusText: 'Created' });
    expect(activity.busy()).toBe(false);
  });

  it('limpia también si falla CSRF y no ejecuta la escritura', () => {
    client.post('/api/v1/branches', {}).subscribe({ error: () => {} });
    http.expectOne('/api/v1/auth/csrf').flush({}, { status: 503, statusText: 'Unavailable' });
    http.expectNone('/api/v1/branches');
    expect(activity.busy()).toBe(false);
  });

  it('excluye servicios externos y admite consultas de fondo optativas', () => {
    client.get('https://external.example.invalid/api').subscribe();
    client
      .get('/api/v1/branches', { context: new HttpContext().set(SKIP_HTTP_ACTIVITY, true) })
      .subscribe();
    expect(activity.busy()).toBe(false);
    http.expectOne('https://external.example.invalid/api').flush({});
    http.expectOne('/api/v1/branches').flush({});
    expect(activity.busy()).toBe(false);
  });

  it('cuenta cada suscripción cuando el llamador solicita un reintento', () => {
    client.get('/api/v1/branches').pipe(retry(1)).subscribe();
    http.expectOne('/api/v1/branches').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(activity.busy()).toBe(true);
    http.expectOne('/api/v1/branches').flush({});
    expect(activity.busy()).toBe(false);
  });
});
