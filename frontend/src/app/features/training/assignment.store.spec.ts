import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore } from '../../core/auth/auth.store';
import { AssignmentStore } from './assignment.store';
const base = '/api/v1/process-assignments';
const request = { personId: 'p', processId: 'c', responsiblePersonId: 'r', branchId: 'b' };
const assignment = {
  ...request,
  id: 'id',
  stateCode: 'PENDING',
  assignedAt: '2026-11-07T00:00:00Z',
  startedAt: null,
  finishedAt: null,
};
describe('HU-008 AssignmentStore', () => {
  const session = signal<object | null>({ userId: 'test' });
  const auth = {
    session,
    authenticated: () => !!session(),
    expireSession: vi.fn(() => session.set(null)),
  };
  let store: AssignmentStore;
  let http: HttpTestingController;
  beforeEach(() => {
    session.set({ userId: 'test' });
    auth.expireSession.mockClear();
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
  });
  afterEach(() => http.verify());
  it('consulta opciones por ASSIGN sin consultar Personas ni Catálogo', () => {
    store.loadOptions();
    http
      .expectOne(base + '/selection-options')
      .flush({ categories: [], processes: [], initialState: { code: 'PENDING' } });
    expect(store.options()?.initialState.code).toBe('PENDING');
    expect(store.loading().options).toBe(false);
  });
  it('envía búsqueda, página, sede derivada y exclusión del participante', () => {
    store.search('responsible', '  Documento  ', 2, 'b', 'p');
    const call = http.expectOne((r) => r.url === base + '/people-options');
    expect(call.request.params.get('search')).toBe('Documento');
    expect(call.request.params.get('page')).toBe('2');
    expect(call.request.params.get('branchId')).toBe('b');
    expect(call.request.params.get('excludePersonId')).toBe('p');
    call.flush({ items: [], pageNumber: 2, pageSize: 10, totalCount: 11 });
    expect(store.responsible()?.items).toEqual([]);
  });
  it('cancela búsquedas obsoletas y selección responsable al cambiar de participante', () => {
    store.search('participant', 'old');
    const old = http.expectOne((r) => r.url.endsWith('people-options'));
    store.search('participant', 'new');
    expect(old.cancelled).toBe(true);
    http.expectOne((r) => r.url.endsWith('people-options')).flush({ items: [] });
    store.search('responsible', '', 1, 'b', 'p');
    const responsible = http.expectOne((r) => r.url.endsWith('people-options'));
    store.resetResponsible();
    expect(responsible.cancelled).toBe(true);
    expect(store.responsible()).toBeNull();
  });
  it('respeta el tamaño elegido al paginar sin perder sede ni exclusión', () => {
    store.search('responsible', 'Ana', 2, 'b', 'p', 20);
    const call = http.expectOne((r) => r.url.endsWith('people-options'));
    expect(call.request.params.get('pageSize')).toBe('20');
    expect(call.request.params.get('page')).toBe('2');
    expect(call.request.params.get('branchId')).toBe('b');
    expect(call.request.params.get('excludePersonId')).toBe('p');
    call.flush({ items: [], pageNumber: 2, pageSize: 20, totalCount: 21 });
  });
  it('confirma solo tras 201 y bloquea doble envío sin fechas, actor ni estado en el DTO', async () => {
    const pending = store.save(request);
    expect(await store.save(request)).toBeNull();
    expect(store.saved()).toBeNull();
    const call = http.expectOne(base);
    expect(call.request.body).toEqual(request);
    expect(call.request.method).toBe('POST');
    call.flush(assignment, { status: 201, statusText: 'Created' });
    expect(await pending).toEqual(assignment);
    expect(store.saved()?.finishedAt).toBeNull();
  });
  it.each([400, 403, 404, 409, 503])(
    'maneja HTTP %s sin éxito falso ni reenvío automático',
    async (status) => {
      const pending = store.save(request);
      http.expectOne(base).flush({}, { status, statusText: 'Failed' });
      expect(await pending).toBeNull();
      expect(store.errors().command).toBeTruthy();
      expect(store.saved()).toBeNull();
      expect(store.busy()).toBe(false);
    },
  );
  it('elimina datos y resuelve comando cancelado cuando cambia la identidad', async () => {
    const pending = store.save(request);
    const call = http.expectOne(base);
    session.set({ userId: 'other' });
    TestBed.tick();
    expect(call.cancelled).toBe(true);
    expect(await pending).toBeNull();
    expect(store.saved()).toBeNull();
    expect(store.errors()).toEqual({});
  });
  it('401 limpia selección, expira sesión y no deja datos ni carga pendiente', () => {
    store.search('participant');
    http
      .expectOne((r) => r.url.endsWith('people-options'))
      .flush({}, { status: 401, statusText: 'Expired' });
    expect(auth.expireSession).toHaveBeenCalled();
    expect(store.participant()).toBeNull();
    expect(store.loading()).toEqual({});
  });
  it('consulta detalle con el contrato existente y maneja 404', () => {
    store.loadDetail('id');
    http.expectOne(base + '/id').flush({}, { status: 404, statusText: 'Not found' });
    expect(store.detail()).toBeNull();
    expect(store.errors().detail).toContain('no existe');
  });
});
