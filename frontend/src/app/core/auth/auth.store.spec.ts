import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
  withNoXsrfProtection,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthStore } from './auth.store';
import { authInterceptor } from './auth.interceptor';
import { CsrfService } from './csrf.service';
import { SessionDto, readSession, toPrincipal } from './auth.models';

const session: SessionDto = {
  userId: 'user-a',
  displayName: 'Cuenta autorizada',
  grants: [
    {
      roleId: 'role-a',
      roleCode: 'OPERATOR',
      branchId: 'sede-a',
      permissions: ['PERSON_VIEW', 'USER_VIEW'],
    },
  ],
};

describe('008: sesión y CSRF reales mediante HttpClient', () => {
  let auth: AuthStore;
  let http: HttpTestingController;
  const router = { url: '/gestion', navigateByUrl: vi.fn().mockResolvedValue(true) };
  const tick = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  beforeEach(() => {
    router.navigateByUrl.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor]), withNoXsrfProtection()),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    auth = TestBed.inject(AuthStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('tolera respuestas de login y sesión remotos de más de diez segundos', async () => {
    vi.useFakeTimers();
    try {
      let settled = false;
      const pending = auth.login('test@example.invalid', 'Password123!');
      void pending.then(() => {
        settled = true;
      });
      csrf('anonymous');
      await vi.advanceTimersByTimeAsync(11000);
      expect(settled).toBe(false);
      http.expectOne('/api/v1/auth/login').flush(session);
      await tick();
      csrf('authenticated');
      await tick();
      await vi.advanceTimersByTimeAsync(11000);
      expect(settled).toBe(false);
      http.expectOne('/api/v1/auth/session').flush(session);
      expect(await pending).toBe(true);
      expect(auth.authenticated()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('limita la espera de sesión a treinta segundos sin reintentar solicitudes', async () => {
    vi.useFakeTimers();
    try {
      const pending = auth.refreshSession();
      const request = http.expectOne('/api/v1/auth/session');
      await vi.advanceTimersByTimeAsync(30001);
      await pending;
      expect(request.cancelled).toBe(true);
      expect(auth.authenticated()).toBe(false);
      expect(auth.error()).toContain('tardando demasiado');
      http.expectNone('/api/v1/auth/session');
    } finally {
      vi.useRealTimers();
    }
  });

  it('no confirma login si la sesión canónica ya fue revocada', async () => {
    const pending = auth.login('test@example.invalid', 'Password123!');
    csrf('anonymous');
    http.expectOne('/api/v1/auth/login').flush(session);
    await tick();
    csrf('authenticated');
    await tick();
    http.expectOne('/api/v1/auth/session').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await pending).toBe(false);
    expect(auth.session()).toBeNull();
    expect(auth.error()).toContain('no pudo verificarse');
  });

  it('no duplica login mientras otra operación de identidad sigue pendiente', async () => {
    const first = auth.login('test@example.invalid', 'Password123!');
    expect(await auth.login('other@example.invalid', 'OtherPassword!')).toBe(false);
    csrf('anonymous');
    http.expectOne('/api/v1/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await first).toBe(false);
  });

  it('deduplica CSRF y no reutiliza una respuesta anterior al cambio de identidad', () => {
    const service = TestBed.inject(CsrfService);
    service.get().subscribe();
    service.get().subscribe();
    const old = http.expectOne('/api/v1/auth/csrf');
    service.reset();
    service.get().subscribe();
    csrf('new-identity');
    old.flush({ token: 'old-identity', headerName: 'X-XSRF-TOKEN' });
    service.get().subscribe((value) => expect(value.token).toBe('new-identity'));
  });

  it('logout con 401 confirma que ya no hay sesión y renueva CSRF anónimo', async () => {
    await restore();
    const pending = auth.logout();
    csrf('authenticated');
    http.expectOne('/api/v1/auth/logout').flush({}, { status: 401, statusText: 'Unauthorized' });
    await tick();
    csrf('anonymous');
    expect(await pending).toBe(true);
    expect(auth.session()).toBeNull();
  });

  async function restore() {
    const pending = auth.refreshSession();
    const request = http.expectOne('/api/v1/auth/session');
    expect(request.request.withCredentials).toBe(true);
    request.flush(session);
    await pending;
  }
  function csrf(token: string) {
    const request = http.expectOne('/api/v1/auth/csrf');
    expect(request.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    request.flush({ token, headerName: 'X-XSRF-TOKEN' });
  }

  it('deduplica restauración y expone usuario, sedes y permisos del servidor', async () => {
    const a = auth.ensureSession();
    const b = auth.ensureSession();
    expect(a).toBe(b);
    expect(auth.busy()).toBe(true);
    http.expectOne('/api/v1/auth/session').flush(session);
    await a;
    expect(auth.user()?.id).toBe('user-a');
    expect(auth.branches()).toEqual(['sede-a']);
    expect(auth.permissions()).toEqual(['PERSON_VIEW', 'USER_VIEW']);
    expect(auth.state()).toBe('authenticated');
  });

  it('reintenta un fallo de conexión al entrar y comparte la comprobación pendiente', async () => {
    const initial = auth.ensureSession();
    http.expectOne('/api/v1/auth/session').flush({}, { status: 503, statusText: 'Unavailable' });
    await initial;
    const first = auth.validateEntrySession();
    const second = auth.validateEntrySession();
    expect(first).toBe(second);
    http.expectOne('/api/v1/auth/session').flush(session);
    await first;
    await auth.validateEntrySession();
    http.expectNone('/api/v1/auth/session');
    expect(auth.authenticated()).toBe(true);
  });

  it('renueva CSRF y consulta sesión en paralelo sin confirmar antes de ambas respuestas', async () => {
    const pending = auth.login(' cuenta@example.invalid ', 'Password123!');
    csrf('anonymous');
    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.body).toEqual({
      email: 'cuenta@example.invalid',
      password: 'Password123!',
    });
    expect(login.request.headers.get('X-XSRF-TOKEN')).toBe('anonymous');
    expect(login.request.withCredentials).toBe(true);
    login.flush(session);
    await tick();
    const canonical = http.expectOne('/api/v1/auth/session');
    csrf('authenticated');
    await tick();
    expect(auth.authenticated()).toBe(false);
    canonical.flush(session);
    expect(await pending).toBe(true);
    expect(auth.session()).toEqual(session);
    expect(auth.busy()).toBe(false);
  });

  it.each([0, 5001])(
    'navegar reutiliza la sesión comprobada incluso después de %sms',
    async (elapsed) => {
      vi.useFakeTimers();
      try {
        const login = auth.login('test@example.invalid', 'Password123!');
        csrf('anonymous');
        http.expectOne('/api/v1/auth/login').flush(session);
        await tick();
        csrf('authenticated');
        http.expectOne('/api/v1/auth/session').flush(session);
        expect(await login).toBe(true);
        await vi.advanceTimersByTimeAsync(elapsed);
        const entry = auth.validateEntrySession();
        http.expectNone('/api/v1/auth/session');
        await entry;
        // Subsequent navigation adds no preliminary request. The API validates resources.
        const next = auth.validateEntrySession();
        http.expectNone('/api/v1/auth/session');
        await next;
        expect(auth.authenticated()).toBe(true);
        const client = TestBed.inject(HttpClient);
        client.get('/api/v1/people').subscribe({ error: () => {} });
        http.expectOne('/api/v1/people').flush({}, { status: 401, statusText: 'Revoked' });
        expect(auth.authenticated()).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('una sesión canónica válida no confirma login si falla la renovación CSRF', async () => {
    const pending = auth.login('test@example.invalid', 'Password123!');
    csrf('anonymous');
    http.expectOne('/api/v1/auth/login').flush(session);
    await tick();
    http.expectOne('/api/v1/auth/session').flush(session);
    expect(auth.authenticated()).toBe(false);
    http.expectOne('/api/v1/auth/csrf').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(await pending).toBe(false);
    const entry = auth.validateEntrySession();
    http.expectNone('/api/v1/auth/session');
    await entry;
    expect(auth.session()).toBeNull();
  });

  it.each([401, 403, 429, 503, 0])(
    'distingue error de login %s y no crea sesión',
    async (status) => {
      const pending = auth.login('cuenta@example.invalid', 'Incorrecta');
      csrf('anonymous');
      http.expectOne('/api/v1/auth/login').flush({}, { status, statusText: 'Failure' });
      expect(await pending).toBe(false);
      expect(auth.session()).toBeNull();
      expect(auth.error()).toBeTruthy();
      if (status === 503 || status === 0) expect(auth.error()).not.toContain('credenciales');
    },
  );

  it('401 retira identidad; 403 de un recurso conserva sesión y no redirige toda la página', async () => {
    await restore();
    const client = TestBed.inject(HttpClient);
    client.get('/api/v1/people').subscribe({ error: () => {} });
    http.expectOne('/api/v1/people').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(auth.authenticated()).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    const refresh = auth.refreshSession();
    http.expectOne('/api/v1/auth/session').flush({}, { status: 401, statusText: 'Unauthorized' });
    await refresh;
    expect(auth.principal()).toBeNull();
    expect(auth.error()).toContain('ha finalizado');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/acceso');
  });

  it('un fallo de logout conserva sesión y permite reintento; éxito revoca estado local', async () => {
    await restore();
    let pending = auth.logout();
    csrf('authenticated');
    http.expectOne('/api/v1/auth/logout').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(await pending).toBe(false);
    expect(auth.authenticated()).toBe(true);
    expect(auth.busy()).toBe(false);
    pending = auth.logout();
    const logout = http.expectOne('/api/v1/auth/logout');
    expect(logout.request.headers.get('X-XSRF-TOKEN')).toBe('authenticated');
    logout.flush(null, { status: 204, statusText: 'No Content' });
    await tick();
    csrf('anonymous');
    expect(await pending).toBe(true);
    expect(auth.session()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/acceso');
  });

  it('una restauración tardía no resucita una sesión cerrada', async () => {
    await restore();
    const oldRefresh = auth.refreshSession();
    const old = http.expectOne('/api/v1/auth/session');
    const logout = auth.logout();
    csrf('authenticated');
    http.expectOne('/api/v1/auth/logout').flush(null);
    await tick();
    csrf('anonymous');
    await logout;
    old.flush(session);
    await oldRefresh;
    expect(auth.session()).toBeNull();
    expect(auth.state()).toBe('anonymous');
  });

  it('rechaza respuestas malformadas y no usa un rol de sede como acceso global', async () => {
    const refresh = auth.refreshSession();
    http.expectOne('/api/v1/auth/session').flush({ userId: 'x' });
    await refresh;
    expect(auth.state()).toBe('error');
    expect(auth.session()).toBeNull();
    expect(() =>
      readSession({ ...session, grants: [{ ...session.grants[0], branchId: null }] }),
    ).toThrow();
    expect(toPrincipal(session).grants.every((g) => g.scope.kind === 'sites')).toBe(true);
  });

  it('no filtra credenciales ni CSRF a EmailJS; invalida CSRF rechazado sin repetir escritura', () => {
    const client = TestBed.inject(HttpClient);
    client.post('https://api.emailjs.com/api/v1.0/email/send', {}).subscribe();
    const external = http.expectOne('https://api.emailjs.com/api/v1.0/email/send');
    expect(external.request.withCredentials).toBe(false);
    expect(external.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    external.flush('OK');
    client.post('/api/v1/people', {}).subscribe({ error: () => {} });
    csrf('old');
    http
      .expectOne('/api/v1/people')
      .flush({ code: 'invalid_csrf' }, { status: 400, statusText: 'Bad Request' });
    http.expectNone('/api/v1/people');
    TestBed.inject(CsrfService).get().subscribe();
    csrf('new');
  });
});
