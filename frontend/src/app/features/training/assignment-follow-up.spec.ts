import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { AUTH_PRINCIPAL, Principal } from '../../core/auth/access-context';
import { AssignmentStore } from './assignment.store';
import { AssignmentListPage } from './assignment-list-page';
import { DEFAULT_ASSIGNMENT_FILTERS } from './assignment.models';
const base = '/api/v1/process-assignments';
const options = {
  branches: [{ id: 'a', name: 'Sede A' }],
  categories: [],
  processes: [],
  responsiblePeople: [],
  states: [],
};
const result = { items: [], pageNumber: 1, pageSize: 25, totalCount: 0, filters: options };
describe('HU-009 consultas y seguimiento', () => {
  const routeParams = new BehaviorSubject(convertToParamMap({}));
  const session = signal<object | null>({ userId: 'u' });
  const principal = signal<Principal | null>(null);
  const auth = {
    session,
    authenticated: () => !!session(),
    expireSession: vi.fn(() => session.set(null)),
  };
  let store: AssignmentStore;
  let http: HttpTestingController;
  beforeEach(() => {
    routeParams.next(convertToParamMap({}));
    session.set({ userId: 'u' });
    auth.expireSession.mockClear();
    principal.set({
      id: 'u',
      displayName: 'Lector',
      roles: ['OPERATOR'],
      grants: [{ permission: 'PROCESS_VIEW', scope: { kind: 'sites', ids: ['a'] } }],
    });
    TestBed.configureTestingModule({
      imports: [AssignmentListPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        AssignmentStore,
        { provide: AuthStore, useValue: auth },
        { provide: AUTH_PRINCIPAL, useValue: principal },
        { provide: ActivatedRoute, useValue: { queryParamMap: routeParams } },
      ],
    });
    store = TestBed.inject(AssignmentStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => http.verify());
  it('envía filtros y página al servidor con una sola petición y opciones autorizadas', () => {
    const filters = {
      ...DEFAULT_ASSIGNMENT_FILTERS,
      page: 2,
      pageSize: 10,
      search: '0001',
      branchId: 'a',
      categoryId: 'c',
      processId: 'p',
      stateCode: 'PENDING',
      responsiblePersonId: 'r',
    };
    store.loadList(filters);
    store.loadList(filters);
    const request = http.expectOne((r) => r.url === base);
    for (const [key, value] of Object.entries(filters))
      expect(request.request.params.get(key)).toBe(String(value));
    expect(request.request.params.get('includeFilters')).toBe('true');
    request.flush(result);
    expect(store.filterOptions()?.branches[0].name).toBe('Sede A');
    store.loadList(filters);
    http.expectNone((r) => r.url === base);
  });
  it('pagina participantes en servidor, cachea la lectura y limpia la identidad', () => {
    const query = { ...DEFAULT_ASSIGNMENT_FILTERS, search: 'ana', page: 2 };
    store.loadParticipants(query);
    store.loadParticipants(query);
    const request = http.expectOne((r) => r.url === base + '/participants');
    expect(request.request.params.get('search')).toBe('ana');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({
      ...result,
      totalCount: 12,
      items: [{ personId: 'unique', personName: 'Ana', branches: [{ id: 'a', name: 'Sede A' }] }],
    });
    expect(store.participants()?.totalCount).toBe(12);
    store.loadParticipants(query);
    http.expectNone((r) => r.url === base + '/participants');
    session.set({ userId: 'other' });
    TestBed.tick();
    expect(store.participants()).toBeNull();
  });
  it('consulta procesos de una persona sin filtros residuales del listado', () => {
    store.loadPersonAssignments('person', 2, 20);
    const request = http.expectOne((r) => r.url === base);
    expect(request.request.params.get('personId')).toBe('person');
    expect(request.request.params.get('orderByCategory')).toBe('true');
    expect(request.request.params.get('pageSize')).toBe('20');
    expect(request.request.params.has('categoryId')).toBe(false);
    request.flush(result);
  });
  it('reutiliza solo metadatos de la sesión, renueva tras 60s y fuerza opciones tras guardar', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      store.loadParticipants(DEFAULT_ASSIGNMENT_FILTERS);
      const initial = http.expectOne((r) => r.url === base + '/participants');
      expect(initial.request.params.get('includeFilters')).toBe('true');
      initial.flush(result);
      store.loadParticipants({ ...DEFAULT_ASSIGNMENT_FILTERS, page: 2 });
      const page = http.expectOne((r) => r.url === base + '/participants');
      expect(page.request.params.get('includeFilters')).toBe('false');
      page.flush({ ...result, filters: null });
      expect(store.filterOptions()?.branches).toEqual(options.branches);
      now.mockReturnValue(61_001);
      store.loadParticipants({ ...DEFAULT_ASSIGNMENT_FILTERS, page: 2 });
      const expired = http.expectOne((r) => r.url === base + '/participants');
      expect(expired.request.params.get('includeFilters')).toBe('true');
      expired.flush(result);
      store.loadParticipants({ ...DEFAULT_ASSIGNMENT_FILTERS, page: 2 }, true);
      const forced = http.expectOne((r) => r.url === base + '/participants');
      expect(forced.request.params.get('includeFilters')).toBe('true');
      forced.flush(result);
      session.set({ userId: 'other' });
      TestBed.tick();
      store.loadParticipants(DEFAULT_ASSIGNMENT_FILTERS);
      const nextUser = http.expectOne((r) => r.url === base + '/participants');
      expect(nextUser.request.params.get('includeFilters')).toBe('true');
      nextUser.flush(result);
    } finally {
      now.mockRestore();
    }
  });
  it('descarta respuestas antiguas y limpia datos al cambiar identidad', () => {
    store.loadList({ ...DEFAULT_ASSIGNMENT_FILTERS, search: 'old' });
    const old = http.expectOne((r) => r.url === base);
    store.loadList({ ...DEFAULT_ASSIGNMENT_FILTERS, search: 'new' });
    expect(old.cancelled).toBe(true);
    http.expectOne((r) => r.url === base).flush({ ...result, items: [{ id: 'visible' }] });
    session.set({ userId: 'other' });
    TestBed.tick();
    expect(store.list()).toBeNull();
    expect(store.filterOptions()).toBeNull();
    expect(store.filters()).toEqual(DEFAULT_ASSIGNMENT_FILTERS);
  });
  it.each([400, 403, 404, 503])(
    'muestra error HTTP %s sin reutilizar filas antiguas y permite reintentar',
    (status) => {
      store.loadList({ ...DEFAULT_ASSIGNMENT_FILTERS });
      http.expectOne((r) => r.url === base).flush(result);
      store.loadList({ ...DEFAULT_ASSIGNMENT_FILTERS }, true);
      http.expectOne((r) => r.url === base).flush({}, { status, statusText: 'Failure' });
      expect(store.list()).toBeNull();
      expect(store.errors().list).toBeTruthy();
      store.loadList({ ...DEFAULT_ASSIGNMENT_FILTERS }, true);
      http.expectOne((r) => r.url === base).flush(result);
      expect(store.errors().list).toBeUndefined();
      expect(store.list()?.totalCount).toBe(0);
    },
  );
  it('401 limpia filtros, opciones y filas y expira la sesión', () => {
    store.loadList({ ...DEFAULT_ASSIGNMENT_FILTERS, search: 'private' });
    http.expectOne((r) => r.url === base).flush({}, { status: 401, statusText: 'Expired' });
    expect(auth.expireSession).toHaveBeenCalled();
    expect(store.list()).toBeNull();
    expect(store.filterOptions()).toBeNull();
    expect(store.filters().search).toBe('');
  });
  it('hidrata URL sin duplicados y reinicia página/proceso cuando cambia categoría', async () => {
    routeParams.next(
      convertToParamMap({
        page: '3',
        pageSize: '10',
        search: 'Ana',
        categoryId: 'c',
        processId: 'p',
      }),
    );
    const fixture = TestBed.createComponent(AssignmentListPage);
    fixture.detectChanges();
    const request = http.expectOne((r) => r.url === base + '/participants');
    expect(request.request.params.get('page')).toBe('3');
    request.flush(result);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.form.controls.categoryId.setValue('other');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ page: 1, categoryId: 'other', processId: null }),
      }),
    );
    expect(fixture.componentInstance.form.controls.search.value).toBe('Ana');
    http.expectNone((r) => r.url === base + '/participants'); // Only URL subscription triggers the HTTP read.
  });
  it('no confunde fecha de inicio nula con fecha de asignación', () => {
    const fixture = TestBed.createComponent(AssignmentListPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === base + '/participants').flush(result);
    expect(fixture.componentInstance.date(null)).toBe('Sin iniciar');
    expect(fixture.componentInstance.date('2026-11-07T12:00:00Z')).not.toBe('Sin iniciar');
  });
  it('no ofrece procesos sin categoría y solo muestra los de la categoría elegida', () => {
    const fixture = TestBed.createComponent(AssignmentListPage);
    fixture.detectChanges();
    const catalog = {
      ...options,
      categories: [
        { id: 'c', name: 'Consolidación' },
        { id: 'd', name: 'Otra' },
      ],
      processes: [
        { id: 'p', name: 'Conexión', categoryId: 'c' },
        { id: 'q', name: 'Otro', categoryId: 'd' },
      ],
    };
    http.expectOne((r) => r.url === base + '/participants').flush({ ...result, filters: catalog });
    expect(fixture.componentInstance.options().processId).toEqual([]);
    routeParams.next(convertToParamMap({ categoryId: 'c' }));
    http.expectOne((r) => r.url === base + '/participants').flush({ ...result, filters: catalog });
    expect(fixture.componentInstance.options().processId.map((p) => p.id)).toEqual(['p']);
    routeParams.next(convertToParamMap({ processId: 'q' }));
    const cleared = http.expectOne((r) => r.url === base + '/participants');
    expect(cleared.request.params.has('processId')).toBe(false);
    cleared.flush({ ...result, filters: catalog });
    expect(fixture.componentInstance.options().processId).toEqual([]);
  });
});
