import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore } from '../../core/auth/auth.store';
import { AUTH_PRINCIPAL, Principal } from '../../core/auth/access-context';
import { CatalogStore } from './catalog.store';
import { Category, DEFAULT_CATALOG_FILTERS } from './catalog.models';
const category: Category = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Categoría',
  description: null,
  sortOrder: 0,
  isActive: true,
  createdAt: '2026-11-07T00:00:00Z',
  updatedAt: '2026-11-07T00:00:00Z',
};
const page = { items: [category], totalCount: 1, pageNumber: 1, pageSize: 10 };
describe('HU-007 CatalogStore', () => {
  const session = signal<object | null>({ userId: 'test' });
  const principal = signal<Principal | null>(null);
  const auth = {
    session,
    authenticated: () => !!session(),
    expireSession: vi.fn(() => session.set(null)),
  };
  let store: CatalogStore;
  let http: HttpTestingController;
  beforeEach(() => {
    session.set({ userId: 'test' });
    principal.set({
      id: 'test',
      displayName: 'Test',
      roles: [],
      grants: ['CATEGORY_VIEW', 'PROCESS_VIEW'].map((permission) => ({
        permission: permission as 'CATEGORY_VIEW' | 'PROCESS_VIEW',
        scope: { kind: 'sites', ids: ['a'] },
      })),
    });
    auth.expireSession.mockClear();
    TestBed.configureTestingModule({
      providers: [
        CatalogStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: auth },
        { provide: AUTH_PRINCIPAL, useValue: principal },
      ],
    });
    store = TestBed.inject(CatalogStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => http.verify());
  it('cada modulo consulta solo su catalogo aunque tenga ambos permisos', () => {
    store.load(DEFAULT_CATALOG_FILTERS, 'category');
    http.expectOne((r) => r.url === '/api/v1/process-categories').flush(page);
    http.expectNone((r) => r.url === '/api/v1/processes');
    store.load(DEFAULT_CATALOG_FILTERS, 'process');
    http.expectOne((r) => r.url === '/api/v1/processes').flush({ ...page, items: [] });
    http.expectNone((r) => r.url === '/api/v1/process-categories');
    store.load();
    http.expectOne((r) => r.url === '/api/v1/processes').flush({ ...page, items: [] });
    http.expectNone((r) => r.url === '/api/v1/process-categories');
  });
  it('consulta ambos permisos por separado y envía filtros y paginación al servidor', () => {
    store.load({
      categories: { page: 2, pageSize: 10, search: 'Cat', active: 'true' },
      processes: {
        page: 3,
        pageSize: 25,
        search: 'Proceso',
        active: 'false',
        categoryId: category.id,
      },
    });
    const c = http.expectOne((r) => r.url === '/api/v1/process-categories');
    expect(c.request.params.get('page')).toBe('2');
    c.flush(page);
    const p = http.expectOne((r) => r.url === '/api/v1/processes');
    expect(p.request.params.get('categoryId')).toBe(category.id);
    expect(p.request.params.get('isActive')).toBe('false');
    p.flush({ ...page, items: [] });
    expect(store.categories()?.items).toEqual([category]);
    expect(store.processes()?.items).toEqual([]);
  });
  it('CATEGORY_VIEW no concede PROCESS_VIEW ni genera su petición', () => {
    principal.update((p) => ({
      ...p!,
      grants: p!.grants.filter((g) => g.permission === 'CATEGORY_VIEW'),
    }));
    TestBed.tick();
    store.load();
    http.expectOne((r) => r.url === '/api/v1/process-categories').flush(page);
    http.expectNone((r) => r.url === '/api/v1/processes');
  });
  it('cancela consultas antiguas y no recupera datos de otra identidad', () => {
    store.loadDetail('category', category.id);
    const previous = http.expectOne('/api/v1/process-categories/' + category.id);
    store.loadDetail('category', category.id);
    expect(previous.cancelled).toBe(true);
    const current = http.expectOne('/api/v1/process-categories/' + category.id);
    session.set({ userId: 'other' });
    TestBed.tick();
    expect(current.cancelled).toBe(true);
    expect(store.item()).toBeNull();
    expect(store.filters()).toEqual(DEFAULT_CATALOG_FILTERS);
  });
  it('solo confirma creación tras 201 y evita doble envío', async () => {
    const body = { name: 'Nueva', description: null, sortOrder: 0 };
    const pending = store.save('category', null, body);
    expect(await store.save('category', null, body)).toBeNull();
    expect(store.notice()).toBeNull();
    const request = http.expectOne('/api/v1/process-categories');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(category, { status: 201, statusText: 'Created' });
    expect(await pending).toEqual(category);
    expect(store.item()).toEqual(category);
  });
  it('clasifica errores sin éxito falso ni perder el contrato de edición', async () => {
    for (const [status, expected] of [
      [400, 'invalid'],
      [403, 'forbidden'],
      [404, 'not-found'],
      [409, 'conflict'],
      [503, 'unconfirmed'],
    ] as const) {
      const pending = store.save('category', category.id, {
        name: 'Cambio',
        description: null,
        sortOrder: 1,
      });
      http
        .expectOne('/api/v1/process-categories/' + category.id)
        .flush({}, { status, statusText: 'Failure' });
      expect(await pending).toBeNull();
      expect(store.commandError()).toBe(expected);
      expect(store.notice()).toBeNull();
    }
  });
  it('cambio de estado 204 recarga el detalle sin inventar fechas', async () => {
    store.loadDetail('category', category.id);
    http.expectOne('/api/v1/process-categories/' + category.id).flush(category);
    const pending = store.setActive('category', category.id, false);
    expect(store.item()?.isActive).toBe(true);
    http
      .expectOne('/api/v1/process-categories/' + category.id + '/active')
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(await pending).toBe(true);
    expect(store.item()).toBeNull();
    http
      .expectOne('/api/v1/process-categories/' + category.id)
      .flush({ ...category, isActive: false, updatedAt: '2026-11-07T01:00:00.123456Z' });
    expect(store.item()?.updatedAt).toBe('2026-11-07T01:00:00.123456Z');
  });
  it('recupera todas las páginas de categorías activas sin truncar opciones', async () => {
    const pending = store.loadOptions();
    expect(store.optionsLoaded()).toBe(false);
    expect(store.optionsLoading()).toBe(true);
    http
      .expectOne((r) => r.url === '/api/v1/process-categories' && r.params.get('page') === '1')
      .flush({
        ...page,
        pageSize: 100,
        totalCount: 101,
        items: Array.from({ length: 100 }, (_, i) => ({ ...category, id: String(i) })),
      });
    await Promise.resolve();
    const second = http.expectOne((r) => r.params.get('page') === '2');
    expect(second.request.params.get('isActive')).toBe('true');
    second.flush({ ...page, pageNumber: 2, pageSize: 100, totalCount: 101 });
    await pending;
    expect(store.options()).toHaveLength(101);
    expect(store.optionsLoaded()).toBe(true);
  });
  it('distingue una consulta vacía confirmada de un fallo al cargar categorías', async () => {
    const empty = store.loadOptions();
    http
      .expectOne((r) => r.url === '/api/v1/process-categories')
      .flush({ ...page, items: [], totalCount: 0 });
    await empty;
    expect(store.optionsLoaded()).toBe(true);
    expect(store.options()).toEqual([]);
    const failed = store.loadOptions();
    expect(store.optionsLoaded()).toBe(false);
    http
      .expectOne((r) => r.url === '/api/v1/process-categories')
      .flush({}, { status: 503, statusText: 'Unavailable' });
    await failed;
    expect(store.optionsLoaded()).toBe(false);
    expect(store.optionsError()).toBe(true);
    expect(store.optionsLoading()).toBe(false);
  });
  it('cancela comandos y resuelve sin datos al perder sesión', async () => {
    const pending = store.save('category', null, {
      name: 'Nueva',
      description: null,
      sortOrder: 0,
    });
    const request = http.expectOne('/api/v1/process-categories');
    session.set(null);
    TestBed.tick();
    expect(await pending).toBeNull();
    expect(request.cancelled).toBe(true);
    expect(store.busy()).toBe(false);
    expect(store.notice()).toBeNull();
  });
  it('401 expira sesión y UUID inválido no consulta la API', async () => {
    store.loadDetail('category', 'bad');
    expect(store.detailError()).toBe('not-found');
    const pending = store.save('category', null, {
      name: 'Nueva',
      description: null,
      sortOrder: 0,
    });
    http
      .expectOne('/api/v1/process-categories')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await pending).toBeNull();
    expect(auth.expireSession).toHaveBeenCalled();
    expect(store.item()).toBeNull();
  });
});
