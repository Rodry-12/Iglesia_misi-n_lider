import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AUTH_PRINCIPAL } from './access-context';
import { sessionGuard, moduleGuard } from './access-guards';
import { AuthStore } from './auth.store';
import { authInterceptor } from './auth.interceptor';

describe('008: guards esperan la sesión HTTP', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTH_PRINCIPAL, useFactory: () => inject(AuthStore).principal },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('las navegaciones tras login no repiten sesión y el 401 de la API revoca el acceso', async () => {
    const auth = TestBed.inject(AuthStore);
    const value = {
      userId: 'u',
      displayName: 'Usuario',
      grants: [{ roleId: 'r', roleCode: 'OPERATOR', branchId: 'a', permissions: ['PERSON_VIEW'] }],
    };
    const login = auth.login('test@example.invalid', 'Password123!');
    http.expectOne('/api/v1/auth/csrf').flush({ token: 'anonymous', headerName: 'X-XSRF-TOKEN' });
    http.expectOne('/api/v1/auth/login').flush(value);
    await Promise.resolve();
    await Promise.resolve();
    http
      .expectOne('/api/v1/auth/csrf')
      .flush({ token: 'authenticated', headerName: 'X-XSRF-TOKEN' });
    http.expectOne('/api/v1/auth/session').flush(value);
    expect(await login).toBe(true);
    expect(await TestBed.runInInjectionContext(() => sessionGuard({ path: 'gestion' }, []))).toBe(
      true,
    );
    http.expectNone('/api/v1/auth/session');
    const next = TestBed.runInInjectionContext(() => sessionGuard({ path: 'gestion' }, []));
    http.expectNone('/api/v1/auth/session');
    expect(await next).toBe(true);
    TestBed.inject(HttpClient)
      .get('/api/v1/people')
      .subscribe({ error: () => {} });
    http.expectOne('/api/v1/people').flush({}, { status: 401, statusText: 'Revoked' });
    const revoked = await TestBed.runInInjectionContext(() =>
      sessionGuard({ path: 'gestion' }, []),
    );
    http.expectNone('/api/v1/auth/session');
    expect(TestBed.inject(Router).serializeUrl(revoked as UrlTree)).toBe('/acceso');
  });

  it('HU-007 requiere alcance global aun cuando una sede tiene el código de creación', async () => {
    const session = TestBed.runInInjectionContext(() => sessionGuard({ path: 'gestion' }, []));
    http.expectOne('/api/v1/auth/session').flush({
      userId: 'u',
      displayName: 'Branch',
      grants: [
        {
          roleId: 'r',
          roleCode: 'BRANCH_ADMIN',
          branchId: 'a',
          permissions: ['CATEGORY_CREATE', 'CATEGORY_VIEW'],
        },
      ],
    });
    await session;
    const result = await TestBed.runInInjectionContext(() =>
      moduleGuard(
        {
          data: { permission: 'CATEGORY_CREATE', globalPermission: true },
        } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/sin-acceso');
  });

  it('HU-002 permiso de alta no hereda permiso de lectura desde el contenedor', async () => {
    const session = TestBed.runInInjectionContext(() => sessionGuard({ path: 'gestion' }, []));
    http.expectOne('/api/v1/auth/session').flush({
      userId: 'u',
      displayName: 'Creator',
      grants: [
        { roleId: 'r', roleCode: 'OPERATOR', branchId: 'a', permissions: ['PERSON_CREATE'] },
      ],
    });
    await session;
    const parent = await TestBed.runInInjectionContext(() =>
      moduleGuard(
        {
          data: { permissionsAnyOf: ['PERSON_VIEW', 'PERSON_CREATE'] },
        } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    expect(parent).toBe(true);
    const detail = await TestBed.runInInjectionContext(() =>
      moduleGuard(
        {
          data: { permission: 'PERSON_VIEW', permissionsAnyOf: ['PERSON_VIEW', 'PERSON_CREATE'] },
        } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    expect(TestBed.inject(Router).serializeUrl(detail as UrlTree)).toBe('/sin-acceso');
  });

  it('no autoriza antes de recibir sesión y deniega un módulo sin permiso', async () => {
    let settled = false;
    const result = TestBed.runInInjectionContext(() => sessionGuard({ path: 'gestion' }, []));
    void Promise.resolve(result).then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    http.expectOne('/api/v1/auth/session').flush({
      userId: 'u',
      displayName: 'Usuario',
      grants: [{ roleId: 'r', roleCode: 'OPERATOR', branchId: 'a', permissions: ['PERSON_VIEW'] }],
    });
    expect(await result).toBe(true);
    const denied = await TestBed.runInInjectionContext(() =>
      moduleGuard(
        { data: { permission: 'USER_VIEW' } } as unknown as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
      ),
    );
    expect(TestBed.inject(Router).serializeUrl(denied as UrlTree)).toBe('/sin-acceso');
  });

  it.each([
    [401, '/acceso'],
    [403, '/sin-acceso'],
  ])('HTTP %s devuelve %s sin habilitar gestión', async (status, path) => {
    const result = TestBed.runInInjectionContext(() => sessionGuard({ path: 'gestion' }, []));
    http
      .expectOne('/api/v1/auth/session')
      .flush({}, { status: status as number, statusText: 'Denied' });
    expect(TestBed.inject(Router).serializeUrl((await result) as UrlTree)).toBe(path);
    expect(TestBed.inject(AuthStore).principal()).toBeNull();
  });
});
