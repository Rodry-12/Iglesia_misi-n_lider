import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore } from '../../core/auth/auth.store';
import { MembersStore } from './members.store';
import {
  calendarDate,
  EMPTY_QUERY,
  identification,
  PeoplePage,
  Person,
  systemDate,
} from './members.models';

const id = '11111111-1111-4111-8111-111111111111';
const person: Person = {
  id,
  firstNames: 'Ana',
  lastNames: 'Prueba',
  phone: null,
  email: null,
  birthDate: '1990-01-01',
  isActive: true,
  branchId: 'a',
  branchName: 'Sede A',
  documents: [],
  hasDocuments: false,
  createdAt: '2026-11-07T00:00:00Z',
  updatedAt: '2026-11-07T00:00:00Z',
};
const page: PeoplePage = {
  items: [person],
  pageNumber: 1,
  pageSize: 25,
  totalCount: 1,
  branches: [{ id: 'a', name: 'Sede A' }],
};

describe('HU-001 MembersStore', () => {
  const session = signal<object | null>({ userId: 'test', grants: ['PERSON_VIEW'] });
  const auth = {
    session,
    authenticated: () => session() !== null,
    expireSession: vi.fn(() => session.set(null)),
  };
  let store: MembersStore;
  let http: HttpTestingController;
  beforeEach(() => {
    session.set({ userId: 'test', grants: ['PERSON_VIEW'] });
    auth.expireSession.mockClear();
    TestBed.configureTestingModule({
      providers: [
        MembersStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: auth },
      ],
    });
    store = TestBed.inject(MembersStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  it('actualiza por UUID, invalida listado, conserva filtros y bloquea doble env?o', async () => {
    store.load({ ...EMPTY_QUERY, search: 'Ana', page: 2 });
    http.expectOne((r) => r.url === '/api/v1/people').flush(page);
    const request = {
      firstNames: 'Nueva',
      lastNames: 'Prueba',
      phone: null,
      email: null,
      birthDate: null,
      expectedUpdatedAt: person.updatedAt!,
    };
    const pending = store.update(id, request);
    expect(await store.update(id, request)).toBeNull();
    const put = http.expectOne('/api/v1/people/' + id);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(request);
    expect(store.updating()).toBe(true);
    expect(store.person()).toBeNull();
    put.flush({ ...person, firstNames: 'Nueva' });
    expect((await pending)?.firstNames).toBe('Nueva');
    expect(store.page()).toBeNull();
    expect(store.query().search).toBe('Ana');
    expect(store.query().page).toBe(2);
  });
  it('clasifica errores de edici?n sin alterar los datos confirmados', async () => {
    for (const [status, expected] of [
      [400, 'invalid'],
      [403, 'forbidden'],
      [404, 'not-found'],
      [409, 'conflict'],
      [500, 'unconfirmed'],
    ] as const) {
      const pending = store.update(id, {
        firstNames: 'Nueva',
        lastNames: 'Prueba',
        phone: null,
        email: null,
        birthDate: null,
        expectedUpdatedAt: person.updatedAt!,
      });
      http.expectOne('/api/v1/people/' + id).flush({}, { status, statusText: 'Error' });
      expect(await pending).toBeNull();
      expect(store.updateError()).toBe(expected);
      expect(store.updating()).toBe(false);
    }
  });
  it('cancela edici?n pendiente y resuelve sin datos al cambiar la identidad', async () => {
    const pending = store.update(id, {
      firstNames: 'Nueva',
      lastNames: 'Prueba',
      phone: null,
      email: null,
      birthDate: null,
      expectedUpdatedAt: person.updatedAt!,
    });
    const request = http.expectOne('/api/v1/people/' + id);
    session.set({ userId: 'other', grants: [] });
    TestBed.tick();
    expect(request.cancelled).toBe(true);
    expect(await pending).toBeNull();
    expect(store.person()).toBeNull();
  });
  it('expira y borra datos si la API responde 401 al guardar', async () => {
    const pending = store.update(id, {
      firstNames: 'Nueva',
      lastNames: 'Prueba',
      phone: null,
      email: null,
      birthDate: null,
      expectedUpdatedAt: person.updatedAt!,
    });
    http.expectOne('/api/v1/people/' + id).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await pending).toBeNull();
    expect(auth.expireSession).toHaveBeenCalled();
    expect(store.person()).toBeNull();
    expect(store.updateError()).toBeNull();
  });
  afterEach(() => http.verify());
  it('cambia estado solo tras 204 y recarga ficha con la versión real del servidor', async () => {
    store.loadPerson(id);
    http.expectOne('/api/v1/people/' + id).flush(person);
    const pending = store.setActive(id, false);
    expect(await store.setActive(id, true)).toBe(false);
    const request = http.expectOne('/api/v1/people/' + id + '/active');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ isActive: false });
    expect(store.person()?.isActive).toBe(true);
    expect(store.stateChanged()).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(await pending).toBe(true);
    expect(store.person()).toBeNull();
    const persisted = { ...person, isActive: false, updatedAt: '2026-11-07T01:00:00.123456Z' };
    http.expectOne('/api/v1/people/' + id).flush(persisted);
    expect(store.person()).toEqual(persisted);
    expect(store.stateChanged()).toBe('inactive');
  });
  it('recarga listado con filtros y paginación para retirar filas que ya no coinciden', async () => {
    const query = { ...EMPTY_QUERY, active: 'true' as const, search: 'Ana', page: 2 };
    store.load(query);
    http.expectOne((r) => r.url === '/api/v1/people').flush(page);
    const pending = store.setActive(id, false);
    http
      .expectOne('/api/v1/people/' + id + '/active')
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(await pending).toBe(true);
    const refresh = http.expectOne((r) => r.url === '/api/v1/people');
    expect(refresh.request.params.get('isActive')).toBe('true');
    expect(refresh.request.params.get('page')).toBe('2');
    refresh.flush({ ...page, items: [], totalCount: 0 });
    expect(store.query()).toEqual(query);
    expect(store.page()?.items).toEqual([]);
  });
  it('clasifica conflictos y fallos sin éxito falso ni modificar el estado local', async () => {
    for (const [status, expected] of [
      [400, 'invalid'],
      [403, 'forbidden'],
      [404, 'not-found'],
      [409, 'conflict'],
      [503, 'unconfirmed'],
    ] as const) {
      const pending = store.setActive(id, false);
      http.expectOne('/api/v1/people/' + id + '/active').flush({}, { status, statusText: 'Error' });
      expect(await pending).toBe(false);
      expect(store.stateChanged()).toBeNull();
      expect(store.stateError()).toBe(expected);
      expect(store.changingStateId()).toBeNull();
    }
  });
  it('no da por confirmado un código de éxito distinto al 204 del contrato', async () => {
    const pending = store.setActive(id, true);
    http
      .expectOne('/api/v1/people/' + id + '/active')
      .flush(null, { status: 200, statusText: 'OK' });
    expect(await pending).toBe(false);
    expect(store.stateError()).toBe('unconfirmed');
    expect(store.stateChanged()).toBeNull();
  });
  it('cancela el cambio pendiente y elimina feedback al cambiar la identidad', async () => {
    const pending = store.setActive(id, false);
    const request = http.expectOne('/api/v1/people/' + id + '/active');
    session.set({ userId: 'other', grants: [] });
    TestBed.tick();
    expect(await pending).toBe(false);
    expect(request.cancelled).toBe(true);
    expect(store.changingStateId()).toBeNull();
    expect(store.stateChanged()).toBeNull();
    expect(store.stateError()).toBeNull();
  });
  it('401 expira la sesión sin conservar información de la persona', async () => {
    const pending = store.setActive(id, false);
    http
      .expectOne('/api/v1/people/' + id + '/active')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await pending).toBe(false);
    expect(auth.expireSession).toHaveBeenCalled();
    expect(store.person()).toBeNull();
    expect(store.stateChanged()).toBeNull();
  });
  it('bloquea operaciones cruzadas de registro, edición y estado durante el envío', async () => {
    store.updating.set(true);
    expect(await store.setActive(id, false)).toBe(false);
    store.updating.set(false);
    const pending = store.setActive(id, false);
    expect(
      await store.update(id, {
        firstNames: 'Ana',
        lastNames: 'Prueba',
        phone: null,
        email: null,
        birthDate: null,
        expectedUpdatedAt: person.updatedAt!,
      }),
    ).toBeNull();
    store.clear();
    expect(await pending).toBe(false);
    http.expectOne('/api/v1/people/' + id + '/active');
  });
  it('usa paginación y filtros de servidor sin llamar branches', () => {
    store.load({
      ...EMPTY_QUERY,
      page: 2,
      pageSize: 10,
      search: '  Ana ',
      branchId: 'a',
      active: 'false',
    });
    const request = http.expectOne((r) => r.url === '/api/v1/people');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    expect(request.request.params.get('search')).toBe('Ana');
    expect(request.request.params.get('branchId')).toBe('a');
    expect(request.request.params.get('isActive')).toBe('false');
    request.flush(page);
    expect(store.page()?.items).toEqual([person]);
    expect(store.branches()).toEqual(page.branches);
  });
  it('cancela consultas anteriores y conserva solo la última búsqueda', () => {
    store.load({ ...EMPTY_QUERY, search: 'anterior' });
    const old = http.expectOne((r) => r.params.get('search') === 'anterior');
    store.load({ ...EMPTY_QUERY, search: 'actual' });
    expect(old.cancelled).toBe(true);
    http.expectOne((r) => r.params.get('search') === 'actual').flush(page);
    expect(store.page()).toEqual(page);
  });
  it('limpia datos y cancela peticiones al perder la sesión', () => {
    store.load();
    http.expectOne((r) => r.url === '/api/v1/people').flush(page);
    store.loadPerson(id);
    const request = http.expectOne(`/api/v1/people/${id}`);
    session.set(null);
    TestBed.tick();
    expect(request.cancelled).toBe(true);
    expect(store.page()).toBeNull();
    expect(store.person()).toBeNull();
    expect(store.branches()).toEqual([]);
  });
  it('descarta una respuesta que llega antes del efecto de cambio de cuenta', () => {
    store.load();
    const request = http.expectOne((r) => r.url === '/api/v1/people');
    session.set({ userId: 'other' });
    request.flush(page);
    expect(store.page()).toBeNull();
    TestBed.tick();
  });
  it('no envía peticiones anónimas', () => {
    session.set(null);
    TestBed.tick();
    store.load();
    store.loadPerson(id);
    expect(store.loading()).toBe(false);
  });
  const registration = {
    branchId: 'a',
    person: { firstNames: 'Ana', lastNames: 'Prueba', phone: null, email: null, birthDate: null },
    document: { issuingCountry: 'CO', documentType: 'CC', documentNumber: '000ABC' },
  };
  it('obtiene sedes de registro por PERSON_CREATE sin usar branches/listado', () => {
    store.loadRegistrationOptions();
    http
      .expectOne('/api/v1/people/registration-options')
      .flush({ branches: page.branches, countries: ['CO'], documentTypes: [] });
    expect(store.registrationOptions()?.branches).toEqual(page.branches);
  });
  it('no confirma éxito antes del POST y bloquea doble envío', async () => {
    store.load();
    http.expectOne((r) => r.url === '/api/v1/people').flush(page);
    const pending = store.create(registration);
    expect(await store.create(registration)).toBeNull();
    expect(store.created()).toBeNull();
    const request = http.expectOne('/api/v1/people');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.document.documentNumber).toBe('000ABC');
    request.flush(person, { status: 201, statusText: 'Created' });
    expect(await pending).toEqual(person);
    expect(store.page()).toBeNull();
    expect(store.creating()).toBe(false);
  });
  it.each([400, 403, 409, 503])('clasifica error de alta %s sin éxito falso', async (status) => {
    const pending = store.create(registration);
    http.expectOne('/api/v1/people').flush({ detail: 'internal' }, { status, statusText: 'Error' });
    expect(await pending).toBeNull();
    expect(store.created()).toBeNull();
    expect(store.createError()).toBe(
      status === 400
        ? 'invalid'
        : status === 403
          ? 'forbidden'
          : status === 409
            ? 'duplicate'
            : 'unconfirmed',
    );
  });
  it('cancela el alta al cerrar sesión y resuelve al consumidor sin retener datos', async () => {
    const pending = store.create(registration);
    const request = http.expectOne('/api/v1/people');
    session.set(null);
    TestBed.tick();
    expect(await pending).toBeNull();
    expect(request.cancelled).toBe(true);
    expect(store.created()).toBeNull();
    expect(store.registrationOptions()).toBeNull();
  });
  it('un 401 de alta expira la sesión', async () => {
    const pending = store.create(registration);
    http.expectOne('/api/v1/people').flush({}, { status: 401, statusText: 'Unauthorized' });
    await pending;
    TestBed.tick();
    expect(auth.expireSession).toHaveBeenCalled();
    expect(store.created()).toBeNull();
  });
  it('401 limpia la sesión y los datos', () => {
    store.load();
    http
      .expectOne((r) => r.url === '/api/v1/people')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    TestBed.tick();
    expect(auth.expireSession).toHaveBeenCalled();
    expect(store.page()).toBeNull();
  });
  it.each([403, 404, 503])('clasifica HTTP %s sin mostrar mensajes privados', (status) => {
    store.loadPerson(id);
    http
      .expectOne(`/api/v1/people/${id}`)
      .flush({ secret: 'internal' }, { status, statusText: 'Error' });
    expect(store.detailError()).toBe(
      status === 403 ? 'forbidden' : status === 404 ? 'not-found' : 'unavailable',
    );
    expect(store.person()).toBeNull();
  });
  it('consulta la ficha por UUID y permite reintentar', () => {
    store.loadPerson(id);
    http.expectOne(`/api/v1/people/${id}`).flush({}, { status: 503, statusText: 'Unavailable' });
    store.loadPerson(id);
    http.expectOne(`/api/v1/people/${id}`).flush(person);
    expect(store.person()).toEqual(person);
    expect(store.detailError()).toBeNull();
  });
  it('UUID inválido muestra el mismo estado no encontrado sin petición', () => {
    store.loadPerson('invalid');
    expect(store.detailError()).toBe('not-found');
  });
});

describe('HU-001 identificación y fechas', () => {
  it('distingue documento ausente, no vigente y vigente', () => {
    expect(identification(person)).toBe('Documento pendiente de regularización');
    expect(identification({ ...person, hasDocuments: true })).toBe('Sin documento vigente');
    expect(
      identification({
        ...person,
        documents: [
          {
            id: 'd',
            documentType: 'CC',
            documentNumber: '123',
            issuingCountry: 'CO',
            isCurrent: true,
            endedAt: null,
          },
        ],
      }),
    ).toBe('CC 123');
  });
  it('preserva el día calendario y usa Colombia para fechas técnicas', () => {
    expect(calendarDate('1990-01-01')).toBe('01/01/1990');
    expect(calendarDate(null)).toBe('No registrada');
    expect(systemDate('2026-11-07T00:00:00Z')).toContain('6');
    expect(systemDate(null)).toBe('No disponible');
  });
});
