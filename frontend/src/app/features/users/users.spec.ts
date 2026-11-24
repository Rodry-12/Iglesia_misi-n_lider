import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { AuthStore } from '../../core/auth/auth.store';
import { UsersStore } from './users.store';
import { UserInviteDialog } from './user-invite-dialog';
import { Notifications } from '../../core/notifications/notifications';
const base = '/api/v1/users';
const user = {
  id: 'u',
  email: 'recipient@example.invalid',
  displayName: 'Destinatario',
  isActive: true,
  emailConfirmed: false,
  personId: null,
  hasPassword: false,
  lockoutEnd: null,
  grants: [{ roleId: 'operator', branchId: 'a', permissionIds: [] }],
};
const body = {
  email: user.email,
  displayName: user.displayName,
  personId: null,
  grants: user.grants,
};
const options = {
  roles: [{ id: 'operator', code: 'OPERATOR' }],
  branches: [{ id: 'a', name: 'Sede A' }],
  permissions: [],
};
describe('HU-012 UsersStore', () => {
  const session = signal<object | null>({ userId: 'admin' });
  const auth = {
    session,
    authenticated: () => !!session(),
    expireSession: vi.fn(() => session.set(null)),
  };
  let store: UsersStore;
  let http: HttpTestingController;
  beforeEach(() => {
    session.set({ userId: 'admin' });
    TestBed.configureTestingModule({
      providers: [
        UsersStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: auth },
      ],
    });
    store = TestBed.inject(UsersStore);
    http = TestBed.inject(HttpTestingController);
    TestBed.tick();
  });
  afterEach(() => http.verify());
  it('descarta resultados anteriores y cancela la búsqueda de persona pendiente', () => {
    store.searchPeople('12345', 'USER_UPDATE');
    const pending = http.expectOne((request) => request.url === base + '/people-options');
    store.clearPeopleSearch();
    expect(pending.cancelled).toBe(true);
    expect(store.people()).toBeNull();
    expect(store.loading().people).toBe(false);
    store.searchPeople('67890', 'USER_UPDATE');
    http
      .expectOne((request) => request.url === base + '/people-options')
      .flush({
        items: [],
        pageNumber: 1,
        pageSize: 25,
        totalCount: 0,
      });
    expect(store.people()?.totalCount).toBe(0);
    store.clearPeopleSearch();
    expect(store.people()).toBeNull();
  });
  it('filtra y pagina en servidor', () => {
    store.loadList({ page: 3, search: 'ana', branchId: 'a', isActive: 'false' });
    const read = http.expectOne((r) => r.url === base);
    expect(read.request.params.get('page')).toBe('3');
    expect(read.request.params.get('isActive')).toBe('false');
    read.flush({ items: [user], pageNumber: 3, pageSize: 25, totalCount: 51 });
    expect(store.list()?.items).toEqual([user]);
  });
  it.each([null, 'persona-vinculada'])(
    'actualiza el perfil sin afirmar revocaciones para personId=%s',
    async (personId) => {
      store.detail.set(user);
      const pending = store.update(user.id, 'Nombre actualizado', personId);
      const update = http.expectOne(base + '/u');
      expect(update.request.method).toBe('PUT');
      expect(update.request.body).toEqual({ displayName: 'Nombre actualizado', personId });
      const updated = { ...user, displayName: 'Nombre actualizado', personId };
      update.flush(updated);
      expect(await pending).toBe(true);
      expect(store.notice()).toBe('Cuenta actualizada.');
      http.expectOne(base + '/u').flush(updated);
      expect(store.detail()).toEqual(updated);
    },
  );
  it('invita sin contraseña, bloquea duplicados y distingue envío no confirmado', async () => {
    const warning = vi.spyOn(TestBed.inject(Notifications), 'warn');
    const pending = store.invite(body);
    expect(await store.invite(body)).toBe(false);
    const put = http.expectOne(base + '/invitations');
    expect(put.request.body).toEqual(body);
    expect('password' in put.request.body).toBe(false);
    put.flush({ user, deliveryStatus: 'unconfirmed' }, { status: 201, statusText: 'Created' });
    expect(await pending).toBe(true);
    expect(store.created()).toEqual(user);
    expect(store.notice()).toContain('no pudo confirmarse');
    expect(warning).toHaveBeenCalledOnce();
  });
  it.each([400, 403, 404, 409, 429, 503])(
    'error%s no afirma creación ni entrega',
    async (status) => {
      const pending = store.invite(body);
      http.expectOne(base + '/invitations').flush({}, { status, statusText: 'Failure' });
      expect(await pending).toBe(false);
      expect(store.created()).toBeNull();
      expect(store.notice()).toBeNull();
      expect(store.errors().command).toBeTruthy();
    },
  );
  it('401 borra datos personales y resuelve escritura pendiente', async () => {
    store.detail.set(user);
    const pending = store.resend(user.id);
    http.expectOne(base + '/u/invitation').flush({}, { status: 401, statusText: 'Expired' });
    expect(await pending).toBe(false);
    expect(store.detail()).toBeNull();
    expect(session()).toBeNull();
  });
  it('cambio de identidad cancela consultas y comandos', async () => {
    store.loadDetail('u');
    const read = http.expectOne(base + '/u');
    const pending = store.invite(body);
    const write = http.expectOne(base + '/invitations');
    session.set({ userId: 'other' });
    TestBed.tick();
    expect(await pending).toBe(false);
    expect(read.cancelled).toBe(true);
    expect(write.cancelled).toBe(true);
    expect(store.created()).toBeNull();
  });
});
describe('HU-012 confirmación de invitación', () => {
  const session = signal({
    userId: 'admin',
    displayName: 'Admin',
    grants: [
      {
        roleId: 'admin-role',
        roleCode: 'SUPER_ADMIN',
        branchId: null,
        permissions: ['USER_CREATE', 'USER_VIEW'],
      },
    ],
  });
  it('no presenta contraseña administrativa y requiere confirmación antes del POST', async () => {
    TestBed.configureTestingModule({
      imports: [UserInviteDialog],
      providers: [
        provideRouter([]),
        UsersStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { session, authenticated: () => true } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}), data: { invite: true } } },
        },
      ],
    });
    const fixture = TestBed.createComponent(UserInviteDialog);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.url.endsWith('/administration-options'))
      .flush({
        ...options,
        permissions: [{ id: 'permission-view', code: 'PERSON_VIEW' }],
      });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type=password]')).toBeNull();
    const page = fixture.componentInstance.editor;
    expect(page.permissionOptions()[0]).toEqual({
      id: 'permission-view',
      code: 'PERSON_VIEW',
      label: 'Consultar personas',
    });
    expect(page.permission('permission-view')).toBe('Consultar personas');
    page.form.patchValue({
      email: user.email,
      displayName: user.displayName,
      grants: [{ roleId: 'operator', branchId: 'a', permissionIds: ['permission-view'] }],
    });
    let dialog: Confirmation | undefined;
    const confirm = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirm, 'confirm').mockImplementation((v) => {
      dialog = v;
      return confirm;
    });
    const cancel = page.save();
    http.expectNone(base + '/invitations');
    dialog?.reject?.();
    await cancel;
    const accepted = page.save();
    dialog?.accept?.();
    await Promise.resolve();
    await Promise.resolve();
    const invitation = http.expectOne(base + '/invitations');
    expect(invitation.request.body.grants[0].permissionIds).toEqual(['permission-view']);
    invitation.flush({ user, deliveryStatus: 'accepted' }, { status: 201, statusText: 'Created' });
    await accepted;
    expect(page.store.created()?.email).toBe(user.email);
    expect(page.form.pristine).toBe(true);
    http.verify();
  });
});
