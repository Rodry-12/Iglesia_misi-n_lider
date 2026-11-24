import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { PersonEditPage } from './person-edit-page';
import { MembersStore } from './members.store';
import { Person } from './members.models';
import { AuthStore } from '../../core/auth/auth.store';
import { AUTH_PRINCIPAL, Principal } from '../../core/auth/access-context';

const person: Person = {
  id: '11111111-1111-4111-8111-111111111111',
  firstNames: 'Ángela María',
  lastNames: 'De la Cruz',
  phone: '+57 001',
  email: null,
  birthDate: '1990-01-01',
  isActive: true,
  branchId: 'a',
  branchName: 'Sede A',
  documents: [
    {
      id: 'd',
      documentType: 'CC',
      issuingCountry: 'CO',
      documentNumber: '000AB9',
      isCurrent: true,
      endedAt: null,
    },
  ],
  hasDocuments: true,
  createdAt: '2026-11-07T00:00:00Z',
  updatedAt: '2026-11-07T00:00:00.123456Z',
};
describe('HU-003 edición', () => {
  const session = signal<object | null>({ userId: 'test' });
  const principal = signal<Principal | null>(null);
  const store = {
    person: signal<Person | null>(null),
    detailLoading: signal(false),
    detailError: signal(null),
    loadPerson: vi.fn(),
    updating: signal(false),
    updateError: signal<string | null>(null),
    update: vi.fn(),
  };
  beforeEach(() => {
    session.set({ userId: 'test' });
    principal.set({
      id: 'test',
      displayName: 'Test',
      roles: [],
      grants: [
        { permission: 'PERSON_VIEW', scope: { kind: 'sites', ids: ['a'] } },
        { permission: 'PERSON_UPDATE', scope: { kind: 'sites', ids: ['a'] } },
      ],
    });
    store.person.set(null);
    store.updating.set(false);
    store.updateError.set(null);
    store.update.mockReset().mockResolvedValue(null);
    store.loadPerson.mockClear();
    TestBed.configureTestingModule({
      imports: [PersonEditPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: person.id })) },
        },
        { provide: MembersStore, useValue: store },
        { provide: AUTH_PRINCIPAL, useValue: principal },
        { provide: AuthStore, useValue: { session, authenticated: computed(() => !!session()) } },
      ],
    }).overrideComponent(PersonEditPage, {
      set: { providers: [ConfirmationService, { provide: MembersStore, useValue: store }] },
    });
  });
  function page() {
    const fixture = TestBed.createComponent(PersonEditPage);
    fixture.componentRef.setInput('personId', person.id);
    fixture.detectChanges();
    store.person.set(person);
    fixture.detectChanges();
    return fixture;
  }
  it('precarga campos, conserva el día y muestra identificación/sede/estado sin controles editables', () => {
    const fixture = page();
    const component = fixture.componentInstance;
    expect(component.form.controls.firstNames.value).toBe('Ángela María');
    expect(component.form.controls.birthDate.value?.getDate()).toBe(1);
    expect(component.changed()).toBe(false);
    expect(component.canLeave()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('000AB9');
    expect(fixture.nativeElement.textContent).toContain('Sede A');
    expect(fixture.nativeElement.querySelector('[formControlName="branchId"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[formControlName="documentNumber"]')).toBeNull();
  });
  it('envía exclusivamente los campos personales normalizados y la versión persistida', async () => {
    const component = page().componentInstance;
    component.form.patchValue({
      firstNames: ' Ángela actualizada ',
      email: ' changed@example.invalid ',
    });
    await component.submit();
    expect(store.update).toHaveBeenCalledWith(person.id, {
      firstNames: 'Ángela actualizada',
      lastNames: 'De la Cruz',
      phone: '+57 001',
      email: 'changed@example.invalid',
      birthDate: '1990-01-01',
      expectedUpdatedAt: person.updatedAt,
    });
    expect(component.saved()).toBe(false);
    expect(component.changed()).toBe(true);
  });
  it('rechaza datos inválidos, sin cambios, envíos pendientes y conflicto sin recarga', async () => {
    const component = page().componentInstance;
    await component.submit();
    expect(store.update).not.toHaveBeenCalled();
    component.form.controls.firstNames.setValue(' ');
    await component.submit();
    expect(store.update).not.toHaveBeenCalled();
    component.form.patchValue({
      firstNames: 'Cambio',
      email: 'invalid',
      birthDate: new Date(2999, 0, 1),
    });
    expect(component.form.invalid).toBe(true);
    await component.submit();
    expect(store.update).not.toHaveBeenCalled();
    component.form.patchValue({ email: null, birthDate: null });
    store.updating.set(true);
    await component.submit();
    expect(store.update).not.toHaveBeenCalled();
    expect(component.canLeave()).toBe(false);
    store.updating.set(false);
    store.updateError.set('conflict');
    await component.submit();
    expect(store.update).not.toHaveBeenCalled();
  });
  it('exige permiso de actualización y lectura en la misma sede sin ampliar concesiones', async () => {
    const component = page().componentInstance;
    principal.update((p) => ({
      ...p!,
      grants: [
        { permission: 'PERSON_VIEW', scope: { kind: 'sites', ids: ['a'] } },
        { permission: 'PERSON_UPDATE', scope: { kind: 'sites', ids: ['b'] } },
      ],
    }));
    component.form.controls.firstNames.setValue('Cambio');
    await component.submit();
    expect(component.allowed()).toBe(false);
    expect(store.update).not.toHaveBeenCalled();
  });
  it('confirma descarte y conserva el borrador al rechazar', async () => {
    const fixture = page();
    const component = fixture.componentInstance;
    component.form.controls.firstNames.setValue('Cambio');
    let confirmation: Confirmation | undefined;
    vi.spyOn(fixture.debugElement.injector.get(ConfirmationService), 'confirm').mockImplementation(
      (value) => {
        confirmation = value;
        return fixture.debugElement.injector.get(ConfirmationService);
      },
    );
    const rejected = component.canLeave();
    confirmation?.reject?.();
    expect(await rejected).toBe(false);
    expect(component.form.controls.firstNames.value).toBe('Cambio');
    const accepted = component.canLeave();
    confirmation?.accept?.();
    expect(await accepted).toBe(true);
  });
  it('borra el borrador y contexto personal cuando expira la sesión', () => {
    const fixture = page();
    const component = fixture.componentInstance;
    component.form.controls.firstNames.setValue('Dato sensible');
    session.set(null);
    fixture.detectChanges();
    expect(component.original()).toBeNull();
    expect(component.form.controls.firstNames.value).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('000AB9');
    expect(component.canLeave()).toBe(true);
  });
  it('solo confirma éxito después de recibir la respuesta de la API', async () => {
    const component = page().componentInstance;
    component.form.controls.firstNames.setValue('Cambio');
    store.update.mockResolvedValue({ ...person, firstNames: 'Cambio' });
    await component.submit();
    expect(component.saved()).toBe(true);
    expect(component.canLeave()).toBe(true);
  });
});
