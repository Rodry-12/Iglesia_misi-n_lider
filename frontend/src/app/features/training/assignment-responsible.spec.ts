import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { AUTH_PRINCIPAL, Principal } from '../../core/auth/access-context';
import { AuthStore } from '../../core/auth/auth.store';
import { AssignmentStore } from './assignment.store';
import { AssignmentPage } from './assignment-page';
import { Assignment, AssignmentPerson } from './assignment.models';
const base = '/api/v1/process-assignments';
const assignment: Assignment = {
  id: 'assignment',
  personId: 'p',
  processId: 'process',
  responsiblePersonId: 'old',
  branchId: 'a',
  stateCode: 'PENDING',
  assignedAt: '2026-11-08T10:00:00Z',
  startedAt: null,
  finishedAt: null,
  responsibleName: 'Anterior',
};
const candidate: AssignmentPerson = {
  id: 'next',
  name: 'Nuevo responsable',
  branchId: 'a',
  branchName: 'Sede A',
  documentType: 'CC',
  documentNumber: '00123',
};
const people = { items: [candidate], pageNumber: 1, pageSize: 10, totalCount: 1 };
describe('HU-011 store', () => {
  const session = signal<object | null>({ userId: 'u' });
  const auth = {
    session,
    authenticated: () => !!session(),
    expireSession: vi.fn(() => session.set(null)),
  };
  let store: AssignmentStore;
  let http: HttpTestingController;
  beforeEach(() => {
    session.set({ userId: 'u' });
    TestBed.configureTestingModule({
      providers: [
        AssignmentStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: auth },
      ],
    });
    store = TestBed.inject(AssignmentStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
    store.detail.set(assignment);
  });
  afterEach(() => http.verify());
  it('consulta candidatos por asignación sin aceptar sede enviada por el cliente', () => {
    store.searchReplacement(assignment.id, ' 00123 ', 2);
    const read = http.expectOne((r) => r.url === base + '/assignment/responsible-options');
    expect(read.request.params.get('search')).toBe('00123');
    expect(read.request.params.get('page')).toBe('2');
    expect(read.request.params.has('branchId')).toBe(false);
    read.flush(people);
    expect(store.responsible()).toEqual(people);
  });
  it('comando con precondición, envío único y recarga persistida después de200', async () => {
    const result = store.changeResponsible('assignment', 'next', 'old');
    expect(await store.changeResponsible('assignment', 'other', 'old')).toBeNull();
    const put = http.expectOne(base + '/assignment/responsible');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      responsiblePersonId: 'next',
      expectedResponsiblePersonId: 'old',
    });
    expect(store.stateNotice()).toBeNull();
    put.flush({ ...assignment, responsiblePersonId: 'next' });
    expect(await result).toBeTruthy();
    expect(store.list()).toBeNull();
    expect(store.stateNotice()).toBe('Responsable actualizado correctamente.');
    http
      .expectOne(base + '/assignment')
      .flush({ ...assignment, responsiblePersonId: 'next', responsibleName: candidate.name });
    expect(store.detail()?.responsibleName).toBe(candidate.name);
  });
  it.each([400, 403, 404, 409, 503])(
    'HTTP %s conserva responsable y no inventa éxito',
    async (status) => {
      const result = store.changeResponsible('assignment', 'next', 'old');
      http.expectOne(base + '/assignment/responsible').flush({}, { status, statusText: 'Failure' });
      expect(await result).toBeNull();
      expect(store.detail()).toEqual(assignment);
      expect(store.stateNotice()).toBeNull();
      expect(store.errors().command).toBeTruthy();
    },
  );
  it('401 cancela búsqueda y borra información de la sesión', async () => {
    store.searchReplacement('assignment');
    const read = http.expectOne((r) => r.url.endsWith('/responsible-options'));
    const result = store.changeResponsible('assignment', 'next', 'old');
    http
      .expectOne(base + '/assignment/responsible')
      .flush({}, { status: 401, statusText: 'Expired' });
    expect(await result).toBeNull();
    expect(read.cancelled).toBe(true);
    expect(store.detail()).toBeNull();
    expect(store.responsible()).toBeNull();
  });
});
describe('HU-011 ficha existente', () => {
  const session = signal<object | null>({ userId: 'u' });
  const principal = signal<Principal | null>(null);
  const store = {
    clear: vi.fn(),
    loadDetail: vi.fn(),
    resetResponsible: vi.fn(),
    searchReplacement: vi.fn(),
    resetTransitions: vi.fn(),
    detail: signal<Assignment | null>(assignment),
    responsible: signal(people),
    busy: signal(false),
    saved: signal(null),
    errors: signal({}),
    loading: signal({}),
    stateNotice: signal(null),
    changeResponsible: vi.fn().mockResolvedValue(assignment),
  };
  beforeEach(() => {
    session.set({ userId: 'u' });
    principal.set({
      id: 'u',
      displayName: 'Usuario',
      roles: ['OPERATOR'],
      grants: [{ permission: 'PROCESS_CHANGE_RESPONSIBLE', scope: { kind: 'sites', ids: ['a'] } }],
    });
    store.detail.set(assignment);
    store.busy.set(false);
    store.changeResponsible.mockReset().mockResolvedValue(assignment);
    store.searchReplacement.mockClear();
    TestBed.configureTestingModule({
      imports: [AssignmentPage],
      providers: [
        provideRouter([]),
        { provide: AssignmentStore, useValue: store },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: 'assignment' }), queryParams: {} },
          },
        },
        { provide: AUTH_PRINCIPAL, useValue: principal },
        { provide: AuthStore, useValue: { session, authenticated: computed(() => !!session()) } },
      ],
    });
  });
  function page() {
    const fixture = TestBed.createComponent(AssignmentPage);
    fixture.detectChanges();
    return fixture;
  }
  function dialog(fixture: ReturnType<typeof page>) {
    const service = fixture.debugElement.injector.get(ConfirmationService);
    let value: Confirmation | undefined;
    vi.spyOn(service, 'confirm').mockImplementation((v) => {
      value = v;
      return service;
    });
    return () => value;
  }
  it('confirmación incluye anterior/nuevo, cancelar no escribe y confirmar envía precondición', async () => {
    const fixture = page();
    const component = fixture.componentInstance;
    const currentDialog = dialog(fixture);
    expect(store.searchReplacement).toHaveBeenCalledWith('assignment', '', 1);
    component.replacementId.setValue('next');
    const pending = component.changeResponsible();
    expect(currentDialog()?.message).toContain('Anterior');
    expect(currentDialog()?.message).toContain(candidate.name);
    expect(store.changeResponsible).not.toHaveBeenCalled();
    await component.changeResponsible();
    currentDialog()?.reject?.();
    await pending;
    expect(component.replacement()).toEqual(candidate);
    const confirmed = component.changeResponsible();
    currentDialog()?.accept?.();
    await confirmed;
    expect(store.changeResponsible).toHaveBeenCalledExactlyOnceWith('assignment', 'next', 'old');
    expect(component.replacement()).toBeNull();
  });
  it('VIEW, ASSIGN o capacidad en otra sede no habilitan el cambio', async () => {
    for (const grant of [
      { permission: 'PROCESS_VIEW' as const, scope: { kind: 'sites' as const, ids: ['a'] } },
      { permission: 'PROCESS_ASSIGN' as const, scope: { kind: 'sites' as const, ids: ['a'] } },
      {
        permission: 'PROCESS_CHANGE_RESPONSIBLE' as const,
        scope: { kind: 'sites' as const, ids: ['b'] },
      },
    ]) {
      principal.update((p) => ({ ...p!, grants: [grant] }));
      const fixture = page();
      fixture.componentInstance.replacementId.setValue('next');
      await fixture.componentInstance.changeResponsible();
      expect(fixture.componentInstance.canChangeResponsible()).toBe(false);
      expect(fixture.nativeElement.textContent).not.toContain('Guardar responsable');
      fixture.destroy();
    }
    expect(store.changeResponsible).not.toHaveBeenCalled();
  });
  it('fallo preserva selección y protege navegación/beforeunload', async () => {
    store.changeResponsible.mockResolvedValue(null);
    const fixture = page();
    const component = fixture.componentInstance;
    const currentDialog = dialog(fixture);
    component.replacementId.setValue('next');
    const write = component.changeResponsible();
    currentDialog()?.accept?.();
    await write;
    expect(component.replacement()).toEqual(candidate);
    const event = new Event('beforeunload', { cancelable: true });
    component.beforeUnload(event as BeforeUnloadEvent);
    expect(event.defaultPrevented).toBe(true);
    const leaving = component.canLeave();
    currentDialog()?.reject?.();
    expect(await leaving).toBe(false);
    expect(component.replacement()).toEqual(candidate);
  });
  it('pérdida de sesión cancela confirmación y borra selección sin escribir', async () => {
    const fixture = page();
    const component = fixture.componentInstance;
    dialog(fixture);
    component.replacementId.setValue('next');
    const pending = component.changeResponsible();
    session.set(null);
    fixture.detectChanges();
    await pending;
    expect(component.replacement()).toBeNull();
    expect(store.changeResponsible).not.toHaveBeenCalled();
  });
});
