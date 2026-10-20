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

describe('003 AC-004 y AC-005: autorización de gestión', () => {
  const principal = signal<Principal | null>(null);
  beforeEach(() => {
    principal.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AUTH_PRINCIPAL, useValue: principal.asReadonly() },
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
    ['finanzas', 'finanzas:leer', 'Finanzas'],
    ['miembros', 'miembros:leer', 'Miembros'],
    ['formacion', 'formacion:leer', 'Formación'],
    ['sedes', 'sedes:leer', 'Sedes'],
    ['usuarios', 'usuarios:administrar', 'Usuarios'],
  ])(
    'abre %s solo con capacidad concedida',
    async (path, permission, title) => {
      authorize(permission);
      const harness = await RouterTestingHarness.create('/gestion/' + path);
      expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe(title);
      expect(harness.routeNativeElement?.textContent).toContain('Próximamente');
    },
    15000,
  ); // La primera ruta autorizada importa el layout y Lucide en frío bajo Vitest/jsdom.

  it('filtra enlaces y bloquea el acceso directo a otro módulo', async () => {
    authorize('sedes:leer');
    const harness = await RouterTestingHarness.create('/gestion/sedes');
    const nav = harness.routeNativeElement?.querySelector('nav');
    expect(nav?.querySelector('a[href="/gestion/sedes"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/gestion/finanzas"]')).toBeNull();
    await harness.navigateByUrl('/gestion/finanzas');
    expect(TestBed.inject(Router).url).toBe('/sin-acceso');
  });

  it('aísla permisos por sede, incluso con el mismo rol o sesión', () => {
    authorize('sedes:leer');
    const access = TestBed.inject(AccessContext);
    expect(access.can('sedes:leer', 'sede-a')).toBe(true);
    expect(access.can('sedes:leer', 'sede-b')).toBe(false);
    expect(access.can('sedes:leer', '')).toBe(false);
    expect(access.can('finanzas:leer', 'sede-a')).toBe(false);
    principal.set(null);
    expect(access.can('sedes:leer', 'sede-a')).toBe(false);
  });

  it('deniega rutas con metadatos incompletos aunque exista sesión', () => {
    authorize('sedes:leer');
    const result = TestBed.runInInjectionContext(() =>
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
      grants: [{ permission: 'sedes:leer', scope: { kind: 'sites', ids: [] } }],
    });
    expect(access.can('sedes:leer')).toBe(false);
    principal.set({
      id: 'test',
      displayName: 'Prueba',
      roles: [],
      grants: [{ permission: 'sedes:leer', scope: { kind: 'all-sites' } }],
    });
    expect(access.can('sedes:leer', 'sede-b')).toBe(true);
  });
});
