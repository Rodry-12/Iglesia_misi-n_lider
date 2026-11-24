import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { AuthStore } from '../../core/auth/auth.store';
import { BranchesStore } from './branches.store';
import { BranchCreateDialog } from './branch-create-dialog';
import { BranchEditDialog } from './branch-edit-dialog';
import { BranchDetailDialog } from './branch-detail-dialog';
import { Notifications } from '../../core/notifications/notifications';

const branch = {
  id: 'a',
  code: 'PARIS',
  name: 'París',
  address: null,
  phone: null,
  isActive: true,
  updatedAt: '2026-11-09T12:00:00Z',
};
const input = { code: branch.code, name: branch.name, address: null, phone: null };
const base = '/api/v1/branches';
describe('HU-013 BranchesStore', () => {
  const session = signal<object | null>({ userId: 'admin' });
  const auth = {
    session,
    authenticated: () => !!session(),
    expireSession: vi.fn(() => session.set(null)),
  };
  let store: BranchesStore;
  let http: HttpTestingController;
  beforeEach(() => {
    session.set({ userId: 'admin' });
    TestBed.configureTestingModule({
      providers: [
        BranchesStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: auth },
      ],
    });
    store = TestBed.inject(BranchesStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => http.verify());
  it('envía búsqueda, filtros y paginación al servidor', () => {
    store.loadList(3, ' París ', 'false');
    const request = http.expectOne((r) => r.url === base);
    expect(request.request.params.get('search')).toBe('París');
    expect(request.request.params.get('isActive')).toBe('false');
    expect(request.request.params.get('page')).toBe('3');
    request.flush({ items: [], pageNumber: 3, pageSize: 25, totalCount: 0 });
    expect(store.list()?.items).toEqual([]);
  });
  it('bloquea envíos duplicados y solo confirma creación tras 201', async () => {
    const pending = store.save(null, input);
    expect(await store.save(null, input)).toBeNull();
    const request = http.expectOne(base);
    expect(request.request.method).toBe('POST');
    request.flush(branch, { status: 201, statusText: 'Created' });
    expect(await pending).toEqual(branch);
    expect(store.notice()).toBeTruthy();
  });
  it('envía la versión esperada al cambiar estado y vuelve a consultar tras 204', async () => {
    const pending = store.setActive(branch);
    const request = http.expectOne(base + '/a/active');
    expect(request.request.body).toEqual({ isActive: false, expectedUpdatedAt: branch.updatedAt });
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(await pending).toBe(true);
    http.expectOne(base + '/a').flush({ ...branch, isActive: false });
    expect(store.detail()?.isActive).toBe(false);
  });
  it.each([400, 403, 404, 409, 503])(
    'error %s conserva el fallo sin afirmar éxito',
    async (status) => {
      const pending = store.save('a', { ...input, expectedUpdatedAt: branch.updatedAt });
      http.expectOne(base + '/a').flush({}, { status, statusText: 'Failure' });
      expect(await pending).toBeNull();
      expect(store.notice()).toBeNull();
      expect(store.errors().command).toBeTruthy();
    },
  );
  it('401 borra datos y expira la sesión', () => {
    store.detail.set(branch);
    store.loadList();
    http.expectOne((r) => r.url === base).flush({}, { status: 401, statusText: 'Expired' });
    expect(store.detail()).toBeNull();
    expect(session()).toBeNull();
  });
  it('ver más conserva los administradores cargados y pide únicamente la página siguiente', () => {
    const first = {
      userId: 'one',
      displayName: 'Uno',
      email: 'one@example.invalid',
      isActive: true,
    };
    const second = { ...first, userId: 'two', displayName: 'Dos' };
    store.loadAdministrators('a');
    http
      .expectOne((r) => r.url.endsWith('/administrators'))
      .flush({ items: [first], pageNumber: 1, pageSize: 25, totalCount: 26 });
    store.loadAdministrators('a', 2, true);
    expect(store.administrators()?.items).toEqual([first]);
    const read = http.expectOne((r) => r.url.endsWith('/administrators'));
    expect(read.request.params.get('page')).toBe('2');
    read.flush({ items: [second], pageNumber: 2, pageSize: 25, totalCount: 26 });
    expect(store.administrators()?.items).toEqual([first, second]);
  });
  it('cambiar de identidad cancela lecturas y comandos y borra administradores', async () => {
    store.loadAdministrators('a');
    const read = http.expectOne((r) => r.url === base + '/a/administrators');
    const pending = store.save(null, input);
    const write = http.expectOne(base);
    session.set({ userId: 'other' });
    TestBed.tick();
    expect(await pending).toBeNull();
    expect(read.cancelled).toBe(true);
    expect(write.cancelled).toBe(true);
    expect(store.administrators()).toBeNull();
  });
});

describe('HU-013 componentes independientes', () => {
  function setup<T>(component: import('@angular/core').Type<T>, role = 'SUPER_ADMIN', id?: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthStore,
          useValue: {
            authenticated: () => true,
            session: signal({
              grants: [{ roleCode: role, branchId: role === 'SUPER_ADMIN' ? null : 'a' }],
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(component);
    if (id) fixture.componentRef.setInput('branchId', id);
    fixture.detectChanges();
    return {
      fixture,
      http: TestBed.inject(HttpTestingController),
      page: fixture.componentInstance,
    };
  }
  it('creación valida campos reales,impide doble envío ysolo emite saved tras201', async () => {
    const { fixture, http, page } = setup(BranchCreateDialog);
    const saved = vi.fn();
    page.saved.subscribe(saved);
    expect(fixture.nativeElement.querySelector('#branch-code')).toBeTruthy();
    page.form.patchValue({ code: ' ', name: 'Nombre' });
    await page.save();
    http.expectNone(base);
    page.form.patchValue({ ...input, address: '', phone: '' });
    const first = page.save();
    await page.save();
    const req = http.expectOne(base);
    expect(saved).not.toHaveBeenCalled();
    req.flush(branch, { status: 201, statusText: 'Created' });
    await first;
    expect(saved).toHaveBeenCalledTimes(1);
    http.verify();
  });
  it('edición usa UUID y versión actuales,conserva formulario ymodal ante409', async () => {
    const { http, page } = setup(BranchEditDialog, 'SUPER_ADMIN', 'a');
    http.expectOne(base + '/a').flush(branch);
    TestBed.tick();
    expect(page.form.controls.name.value).toBe('París');
    page.form.controls.name.setValue('Actualizada');
    page.form.markAsDirty();
    const saved = vi.fn();
    page.saved.subscribe(saved);
    const pending = page.save();
    const req = http.expectOne(base + '/a');
    expect(req.request.body.expectedUpdatedAt).toBe(branch.updatedAt);
    req.flush({}, { status: 409, statusText: 'Conflict' });
    await pending;
    TestBed.tick();
    expect(saved).not.toHaveBeenCalled();
    expect(page.form.controls.name.value).toBe('Actualizada');
    expect(page.store.errors().command).toBeTruthy();
    http.verify();
  });
  it('cancelar borrador pregunta antes decerrar ypuede conservar losdatos', async () => {
    const { fixture, page } = setup(BranchCreateDialog);
    page.form.markAsDirty();
    const closed = vi.fn();
    page.closed.subscribe(closed);
    let confirm: Confirmation | undefined;
    const service = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(service, 'confirm').mockImplementation((value) => {
      confirm = value;
      return service;
    });
    const pending = page.requestClose();
    expect(closed).not.toHaveBeenCalled();
    confirm?.reject?.();
    await pending;
    expect(closed).not.toHaveBeenCalled();
    expect(page.form.dirty).toBe(true);
    const next = page.requestClose();
    confirm?.accept?.();
    await next;
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it('BRANCH_ADMIN consulta sinmutaciones niadministradores', () => {
    const { fixture, http, page } = setup(BranchDetailDialog, 'BRANCH_ADMIN', 'a');
    http.expectOne(base + '/a').flush(branch);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Desactivar sede');
    expect(page.global()).toBe(false);
    http.expectNone(base + '/a/active');
    http.expectNone((r) => r.url.endsWith('/administrators'));
    http.verify();
  });
  it('no abre consulta hasta tener detalle yadministradores,sin controles de escritura', () => {
    const { fixture, http, page } = setup(BranchDetailDialog, 'SUPER_ADMIN', 'a');
    expect(page.opened()).toBe(false);
    http.expectOne(base + '/a').flush(branch);
    fixture.detectChanges();
    expect(page.opened()).toBe(false);
    http
      .expectOne((r) => r.url.endsWith('/administrators'))
      .flush({ items: [], pageNumber: 1, pageSize: 25, totalCount: 0 });
    fixture.detectChanges();
    expect(page.opened()).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Editar sede');
    expect(fixture.nativeElement.textContent).not.toContain('Desactivar sede');
    http.verify();
  });
  it('edición exige confirmación deestado ysolo notifica después de204', async () => {
    const { fixture, http, page } = setup(BranchEditDialog, 'SUPER_ADMIN', 'a');
    http.expectOne(base + '/a').flush(branch);
    fixture.detectChanges();
    const service = fixture.debugElement.injector.get(ConfirmationService);
    let confirm: Confirmation | undefined;
    vi.spyOn(service, 'confirm').mockImplementation((value) => {
      confirm = value;
      return service;
    });
    const toast = vi.spyOn(TestBed.inject(Notifications), 'success');
    await page.changeState();
    http.expectNone(base + '/a/active');
    confirm?.reject?.();
    await page.changeState();
    confirm?.accept?.();
    expect(toast).not.toHaveBeenCalled();
    http.expectOne(base + '/a/active').flush(null, { status: 204, statusText: 'No Content' });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(base + '/a').flush({ ...branch, isActive: false });
    expect(toast).toHaveBeenCalledOnce();
    http.verify();
  });
});
