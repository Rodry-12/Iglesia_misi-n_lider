import { computed, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AUTH_PRINCIPAL } from '../../core/auth/access-context';
import { AuthStore } from '../../core/auth/auth.store';
import { SessionDto, toPrincipal } from '../../core/auth/auth.models';
import { OverviewPage } from './overview-page';
import { AdminLayout } from '../../layout/admin-layout/admin-layout';
import { AccountMenu } from '../../layout/admin-layout/account-menu';

describe('003: presentación de gestión con sesión real como fuente', () => {
  const session = signal<SessionDto | null>(null);
  beforeEach(() => {
    session.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AUTH_PRINCIPAL,
          useValue: computed(() => (session() ? toPrincipal(session()!) : null)),
        },
        {
          provide: AuthStore,
          useValue: {
            session,
            busy: signal(false),
            error: signal(null),
            logout: vi.fn(),
            refreshSession: vi.fn(),
          },
        },
      ],
    });
  });

  it('deduplica permisos entre sedes sin presentar una cuenta limitada como global', () => {
    session.set({
      userId: 'own-user',
      displayName: 'Cuenta de dos sedes',
      grants: [
        {
          roleId: 'r1',
          roleCode: 'BRANCH_ADMIN',
          branchId: 'sede-a',
          permissions: ['PERSON_VIEW', 'PROCESS_VIEW'],
        },
        {
          roleId: 'r2',
          roleCode: 'OPERATOR',
          branchId: 'sede-b',
          permissions: ['PERSON_VIEW', 'BRANCH_VIEW'],
        },
      ],
    });
    const fixture = TestBed.createComponent(OverviewPage);
    fixture.detectChanges();
    expect(fixture.componentInstance.permissionCount()).toBe(3);
    expect(fixture.componentInstance.branches()).toEqual(['sede-a', 'sede-b']);
    expect(fixture.nativeElement.textContent).toContain('2 sedes autorizadas');
    expect(fixture.nativeElement.textContent).not.toContain('Todas las sedes');
    expect(fixture.nativeElement.textContent).not.toContain('Misión Líder París');
    expect(fixture.nativeElement.querySelector('#session-permissions')).toBeNull();
    const button = fixture.nativeElement.querySelector(
      '[aria-controls="session-permissions"]',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('#session-permissions').textContent).toContain(
      'Consultar personas',
    );
    const text = fixture.nativeElement.querySelector('#session-permissions').textContent;
    expect(text).not.toContain('sede-b');
    expect(text).not.toContain('own-user');
    expect(text).not.toContain('PERSON_VIEW');
    expect(text).not.toContain('Detalle de acceso');
    expect(session()?.grants[0].permissions).toContain('PERSON_VIEW');
  });

  it('muestra alcance global solo con SUPER_ADMIN y mantiene su información técnica secundaria', () => {
    session.set({
      userId: 'global-user',
      displayName: 'Cuenta global',
      grants: [
        {
          roleId: 'r',
          roleCode: 'SUPER_ADMIN',
          branchId: null,
          permissions: ['PERSON_VIEW', 'USER_VIEW'],
        },
      ],
    });
    const fixture = TestBed.createComponent(OverviewPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SuperAdministrador');
    expect(fixture.nativeElement.textContent).toContain('Todas las sedes');
    expect(fixture.componentInstance.navigation().map((item) => item.path)).toEqual([
      '/gestion/miembros',
      '/gestion/usuarios',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('global-user');
  });

  it('sidebar y accesos rápidos conservan el ámbito y esconden módulos no concedidos', () => {
    session.set({
      userId: 'operator',
      displayName: 'Operador',
      grants: [
        { roleId: 'r', roleCode: 'OPERATOR', branchId: 'sede-a', permissions: ['PERSON_VIEW'] },
      ],
    });
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav a[href="/gestion/miembros"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('nav a[href="/gestion/usuarios"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('nav a[href="/gestion/formacion"]')).toBeNull();
    fixture.componentInstance.menuOpen.set(true);
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('nav')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.menuOpen()).toBe(false);
  });

  it('el navbar conserva tema y cuenta, sin logo ni enlace al sitio público', async () => {
    session.set({
      userId: 'account',
      displayName: 'Cuenta de sede',
      grants: [
        {
          roleId: 'r',
          roleCode: 'BRANCH_ADMIN',
          branchId: 'sede-a',
          branchName: 'Sede París',
          permissions: ['BRANCH_VIEW'],
        },
      ],
    });
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('header');
    expect(header.querySelector('.application-name').textContent).toContain('Sede París');
    expect(fixture.nativeElement.querySelector('.sidebar-brand').textContent.trim()).toBe(
      'Panel de gestión',
    );
    expect(header.textContent).not.toContain('Misión Líder París');
    expect(header.textContent).toContain('Cuenta de sede');
    expect(header.textContent).toContain('Administrador de sede');
    expect(header.querySelector('img')).toBeNull();
    expect(header.querySelector('a[href="/"]')).toBeNull();
    expect(header.querySelector('app-theme-toggle')).not.toBeNull();
    expect(
      header.querySelector('[aria-label="Menú de cuenta"]').getAttribute('aria-haspopup'),
    ).toBe('menu');
    const menu = fixture.debugElement.query(By.directive(AccountMenu))
      .componentInstance as AccountMenu;
    expect(menu.initials()).toBe('CD');
    menu.items[0].command?.({});
    expect(TestBed.inject(AuthStore).logout).toHaveBeenCalledTimes(1);
  });

  it('presenta solo la primera sede y reserva el alcance global para SUPER_ADMIN', () => {
    const grant = {
      roleId: 'r',
      roleCode: 'OPERATOR' as const,
      branchId: 'a',
      branchName: 'Sede París',
      permissions: ['PERSON_VIEW'],
    };
    session.set({
      userId: 'u',
      displayName: 'Operador',
      grants: [
        grant,
        { ...grant, roleId: 'r2' },
        { ...grant, branchId: 'b', branchName: 'Sede Norte' },
      ],
    });
    const fixture = TestBed.createComponent(AdminLayout);
    fixture.detectChanges();
    expect(fixture.componentInstance.branchLabel()).toBe('Sede París');
    expect(fixture.nativeElement.querySelector('.application-name').textContent).not.toContain(
      'Sede Norte',
    );
    session.set({ ...session()!, grants: [{ ...grant, branchName: undefined }] });
    fixture.detectChanges();
    expect(fixture.componentInstance.branchLabel()).toBe('Sede autorizada');
    session.set({ ...session()!, grants: [{ ...grant, roleCode: 'SUPER_ADMIN', branchId: null }] });
    fixture.detectChanges();
    expect(fixture.componentInstance.branchLabel()).toBe('Todas las sedes');
  });

  it('una cuenta solo CREATE conserva el acceso existente al registro sin inventar permisos VIEW', () => {
    session.set({
      userId: 'creator',
      displayName: 'Registro',
      grants: [
        { roleId: 'r', roleCode: 'OPERATOR', branchId: 'sede-a', permissions: ['PERSON_CREATE'] },
      ],
    });
    const fixture = TestBed.createComponent(OverviewPage);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('a[href="/gestion/miembros/registrar"]'),
    ).not.toBeNull();
    expect(fixture.componentInstance.navigation()).toHaveLength(0);
    session.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-grid')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Registro');
  });
});
