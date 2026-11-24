import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Notifications } from '../../core/notifications/notifications';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { AUTH_PRINCIPAL, Principal } from '../../core/auth/access-context';
import { MembersStore } from './members.store';
import { Person } from './members.models';
import { PersonStateAction, PersonStateFeedback } from './person-state-action';

const person: Person = {
  id: '11111111-1111-4111-8111-111111111111',
  firstNames: 'Ana',
  lastNames: 'Prueba',
  phone: null,
  email: null,
  birthDate: null,
  isActive: true,
  branchId: 'a',
  branchName: 'Sede A',
  documents: [],
  hasDocuments: false,
  createdAt: null,
  updatedAt: null,
};
describe('HU-004 acciones de estado', () => {
  const principal = signal<Principal | null>(null);
  const store = {
    changingStateId: signal<string | null>(null),
    creating: signal(false),
    updating: signal(false),
    stateChanged: signal<'active' | 'inactive' | null>(null),
    stateError: signal<string | null>(null),
    setActive: vi.fn().mockResolvedValue(true),
  };
  beforeEach(() => {
    principal.set({
      id: 'test',
      displayName: 'Prueba',
      roles: ['OPERATOR'],
      grants: [
        { permission: 'PERSON_VIEW', scope: { kind: 'sites', ids: ['a'] } },
        { permission: 'PERSON_DEACTIVATE', scope: { kind: 'sites', ids: ['a'] } },
      ],
    });
    store.changingStateId.set(null);
    store.creating.set(false);
    store.updating.set(false);
    store.stateChanged.set(null);
    store.stateError.set(null);
    store.setActive.mockClear();
    TestBed.configureTestingModule({
      imports: [PersonStateAction, PersonStateFeedback],
      providers: [
        { provide: MembersStore, useValue: store },
        { provide: AUTH_PRINCIPAL, useValue: principal },
      ],
    });
  });
  function page(active = true) {
    const fixture = TestBed.createComponent(PersonStateAction);
    fixture.componentRef.setInput('person', { ...person, isActive: active });
    fixture.detectChanges();
    let dialog: Confirmation | undefined;
    const confirmation = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(confirmation, 'confirm').mockImplementation((options) => {
      dialog = options;
      return confirmation;
    });
    return { fixture, component: fixture.componentInstance, dialog: () => dialog, confirmation };
  }
  it('requiere capacidad y lectura efectivas en la sede del registro', () => {
    const { fixture, component } = page();
    expect(component.allowed()).toBe(true);
    principal.update((p) => ({
      ...p!,
      grants: [
        { permission: 'PERSON_VIEW', scope: { kind: 'sites', ids: ['a'] } },
        { permission: 'PERSON_DEACTIVATE', scope: { kind: 'sites', ids: ['b'] } },
      ],
    }));
    fixture.detectChanges();
    expect(component.allowed()).toBe(false);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    component.requestChange();
    expect(store.setActive).not.toHaveBeenCalled();
  });
  it('confirma antes de desactivar y cancelar no envía solicitudes', () => {
    const { component, dialog } = page();
    component.requestChange();
    expect(store.setActive).not.toHaveBeenCalled();
    expect(dialog()?.message).toContain('se revocarán sus sesiones');
    dialog()?.reject?.();
    expect(store.setActive).not.toHaveBeenCalled();
    component.requestChange();
    dialog()?.accept?.();
    expect(store.setActive).toHaveBeenCalledExactlyOnceWith(person.id, false);
  });
  it('reactiva con el valor absoluto true y respeta el estado de envío', () => {
    const { fixture, component } = page(false);
    component.requestChange();
    expect(store.setActive).toHaveBeenCalledExactlyOnceWith(person.id, true);
    store.changingStateId.set(person.id);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
    component.requestChange();
    expect(store.setActive).toHaveBeenCalledTimes(1);
  });
  it('no acepta una confirmación si se pierden permisos o cambia el registro', () => {
    const { fixture, component, dialog, confirmation } = page();
    const close = vi.spyOn(confirmation, 'close');
    component.requestChange();
    principal.set(null);
    fixture.detectChanges();
    dialog()?.accept?.();
    expect(close).toHaveBeenCalled();
    expect(store.setActive).not.toHaveBeenCalled();
    fixture.componentRef.setInput('person', { ...person, isActive: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
  it('notifica éxito y errores de negocio en Toast sin banner ni información de cuentas', () => {
    const service = TestBed.inject(Notifications);
    const error = vi.spyOn(service, 'error');
    const success = vi.spyOn(service, 'success');
    const fixture = TestBed.createComponent(PersonStateFeedback);
    store.stateError.set('conflict');
    fixture.detectChanges();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('procesos abiertos'));
    expect(fixture.nativeElement.textContent.trim()).toBe('');
    store.stateError.set(null);
    store.stateChanged.set('inactive');
    fixture.detectChanges();
    expect(success).toHaveBeenCalledWith('Desactivación confirmada.');
    store.stateChanged.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
