import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AccessContext, AUTH_PRINCIPAL, Permission, Principal } from './access-context';
import { moduleGuard } from './access-guards';
import { AuthStore } from './auth.store';

describe('003 AC-004 y AC-005: autorización de gestión', () => {
  const principal = signal<Principal | null>(null);
  beforeEach(() => {
    principal.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AUTH_PRINCIPAL, useValue: principal.asReadonly() },
        {
          provide: AuthStore,
          useValue: {
            refreshSession: async () => {},
            validateEntrySession: async () => {},
            ensureSession: async () => {},
            state: () => (principal() ? 'authenticated' : 'anonymous'),
            authenticated: () => !!principal(),
            busy: signal(false),
            error: signal(null),
            session: signal(null),
            logout: vi.fn(),
          },
        },
      ],
    });
  });

  function authorize(permission?: Permission) {
    principal.set({
      id: 'test-user',
      displayName: 'Cuenta de prueba',
      roles: [],
      grants: permission ? [{ permission, scope: { kind: 'sites', ids: ['sede-a'] } }] : [],
    });
  }

  it('un recurso sin sede requiere alcance global explícito', () => {
    authorize('PERSON_UPDATE');
    const access = TestBed.inject(AccessContext);
    expect(access.can('PERSON_UPDATE', null)).toBe(false);
    expect(access.can('PERSON_UPDATE', '')).toBe(false);
    principal.set({
      id: 'global',
      displayName: 'Global',
      roles: ['SUPER_ADMIN'],
      grants: [{ permission: 'PERSON_UPDATE', scope: { kind: 'all-sites' } }],
    });
    expect(access.can('PERSON_UPDATE', null)).toBe(true);
    expect(access.can('PERSON_UPDATE', 'sede-a')).toBe(true);
    expect(access.can('PERSON_VIEW', null)).toBe(false);
  });

  it('deniega por defecto y redirige una URL administrativa anónima', async () => {
    const harness = await RouterTestingHarness.create('/gestion/finanzas');
    expect(TestBed.inject(Router).url).toBe('/acceso');
    expect(harness.routeNativeElement?.textContent).toContain('Acceso a gestión');
  });

  it('rechaza una sesión sin el permiso requerido', async () => {
    authorize();
    await RouterTestingHarness.create('/gestion/usuarios');
    expect(TestBed.inject(Router).url).toBe('/sin-acceso');
  });

  it.each<[string, Permission, string]>([
    ['miembros', 'PERSON_VIEW', 'Gestión de Personas'],
    ['formacion', 'PROCESS_VIEW', 'Formación'],
    ['sedes', 'BRANCH_VIEW', 'Administración de sedes'],
    ['usuarios', 'USER_VIEW', 'Usuarios'],
  ])(
    'abre %s solo con capacidad concedida',
    async (path, permission, title) => {
      authorize(permission);
      const harness = await RouterTestingHarness.create('/gestion/' + path);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(title);
      expect(harness.routeNativeElement?.textContent).not.toContain('Próximamente');
    },
    15000,
  ); // La primera ruta autorizada importa el layout y Lucide en frío bajo Vitest/jsdom.

  it('filtra enlaces y bloquea el acceso directo a otro módulo', async () => {
    authorize('BRANCH_VIEW');
    const harness = await RouterTestingHarness.create('/gestion/sedes');
    const nav = harness.routeNativeElement?.querySelector('nav');
    expect(nav?.querySelector('a[href="/gestion/sedes"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/gestion/finanzas"]')).toBeNull();
    await harness.navigateByUrl('/gestion/finanzas');
    expect(TestBed.inject(Router).url).toBe('/sin-acceso');
  });

  it('aísla permisos por sede, incluso con el mismo rol o sesión', () => {
    authorize('BRANCH_VIEW');
    const access = TestBed.inject(AccessContext);
    expect(access.can('BRANCH_VIEW', 'sede-a')).toBe(true);
    expect(access.can('BRANCH_VIEW', 'sede-b')).toBe(false);
    expect(access.can('BRANCH_VIEW', '')).toBe(false);
    expect(access.can('PERSON_VIEW', 'sede-a')).toBe(false);
    principal.set(null);
    expect(access.can('BRANCH_VIEW', 'sede-a')).toBe(false);
  });

  it('deniega rutas con metadatos incompletos aunque exista sesión', async () => {
    authorize('BRANCH_VIEW');
    const result = await TestBed.runInInjectionContext(() =>
      moduleGuard({ data: {} } as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/sin-acceso');
  });

  it('un ámbito vacío no concede capacidad y todas las sedes exige concesión explícita', () => {
    const access = TestBed.inject(AccessContext);
    principal.set({
      id: 'test',
      displayName: 'Prueba',
      roles: [],
      grants: [{ permission: 'BRANCH_VIEW', scope: { kind: 'sites', ids: [] } }],
    });
    expect(access.can('BRANCH_VIEW')).toBe(false);
    principal.set({
      id: 'test',
      displayName: 'Prueba',
      roles: [],
      grants: [{ permission: 'BRANCH_VIEW', scope: { kind: 'all-sites' } }],
    });
    expect(access.can('BRANCH_VIEW', 'sede-b')).toBe(true);
  });
});
