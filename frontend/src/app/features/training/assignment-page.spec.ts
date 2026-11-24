import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { AUTH_PRINCIPAL, Principal } from '../../core/auth/access-context';
import { AuthStore } from '../../core/auth/auth.store';
import { AssignmentPage } from './assignment-page';
import { AssignmentStore } from './assignment.store';
const person = {
  id: 'p',
  name: 'Persona',
  branchId: 'b',
  branchName: 'Sede',
  documentType: 'CC',
  documentNumber: '0001',
};
const responsible = { ...person, id: 'r', name: 'Responsable' };
describe('HU-008 formulario', () => {
  const session = signal<object | null>({ userId: 'u' });
  const principal = signal<Principal | null>(null);
  const store = {
    clear: vi.fn(),
    loadOptions: vi.fn(),
    search: vi.fn(),
    loadDetail: vi.fn(),
    resetResponsible: vi.fn(),
    options: signal({
      categories: [],
      processes: [{ id: 'process', categoryId: 'category', name: 'Proceso' }],
      initialState: { code: 'PENDING', name: 'Pendiente' },
    }),
    participant: signal({ items: [person], pageNumber: 1, pageSize: 10, totalCount: 1 }),
    responsible: signal({ items: [responsible], pageNumber: 1, pageSize: 10, totalCount: 1 }),
    errors: signal({}),
    loading: signal({}),
    busy: signal(false),
    saved: signal<unknown>(null),
    detail: signal(null),
    save: vi.fn().mockResolvedValue(null),
  };
  beforeEach(() => {
    session.set({ userId: 'u' });
    principal.set({
      id: 'u',
      displayName: 'Usuario',
      roles: ['OPERATOR'],
      grants: [{ permission: 'PROCESS_ASSIGN', scope: { kind: 'sites', ids: ['b'] } }],
    });
    store.save.mockClear();
    store.saved.set(null);
    store.busy.set(false);
    TestBed.configureTestingModule({
      imports: [AssignmentPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}), queryParams: {} } },
        },
        { provide: AssignmentStore, useValue: store },
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
  function select(component: AssignmentPage) {
    component.form.patchValue({
      personId: 'p',
      categoryId: 'category',
      processId: 'process',
      responsiblePersonId: 'r',
    });
    component.form.markAsDirty();
  }
  it('requiere selecciones y deriva la sede del participante sin permiso PERSON_VIEW', async () => {
    const component = page().componentInstance;
    await component.submit();
    expect(store.save).not.toHaveBeenCalled();
    select(component);
    await component.submit();
    expect(store.save).toHaveBeenCalledWith({
      personId: 'p',
      processId: 'process',
      responsiblePersonId: 'r',
      branchId: 'b',
    });
    expect(component.participant()?.documentNumber).toBe('0001');
  });
  it('limpia responsable y proceso cuando cambian sus dependencias', () => {
    const component = page().componentInstance;
    select(component);
    component.form.controls.personId.setValue('p');
    expect(component.form.controls.responsiblePersonId.value).toBe('');
    expect(component.responsible()).toBeNull();
    component.form.controls.categoryId.setValue('other');
    expect(component.form.controls.processId.value).toBe('');
  });
  it('rechaza sede sin permiso y conserva borrador tras fallo recuperable', async () => {
    const component = page().componentInstance;
    select(component);
    principal.update((p) => ({
      ...p!,
      grants: [{ permission: 'PROCESS_ASSIGN', scope: { kind: 'sites', ids: ['other'] } }],
    }));
    await component.submit();
    expect(store.save).not.toHaveBeenCalled();
    expect(component.form.dirty).toBe(true);
  });
  it('confirma cancelación y elimina datos al perder sesión', async () => {
    const fixture = page();
    const component = fixture.componentInstance;
    select(component);
    const service = fixture.debugElement.injector.get(ConfirmationService);
    let dialog: Confirmation | undefined;
    vi.spyOn(service, 'confirm').mockImplementation((value) => {
      dialog = value;
      return service;
    });
    const pending = component.canLeave();
    dialog?.reject?.();
    expect(await pending).toBe(false);
    session.set(null);
    fixture.detectChanges();
    expect(component.participant()).toBeNull();
    expect(component.form.controls.personId.value).toBe('');
    expect(component.canLeave()).toBe(true);
  });
});
