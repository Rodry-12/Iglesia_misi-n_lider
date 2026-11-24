import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PersonRegistrationPage, birthDateValue, validBirthDate } from './person-registration-page';
import { MembersStore } from './members.store';
import { AuthStore } from '../../core/auth/auth.store';
import { AUTH_PRINCIPAL, Principal } from '../../core/auth/access-context';
import { FormControl } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';

describe('HU-002 formulario', () => {
  const session = signal<object | null>({ userId: 'test' });
  const created = signal(null);
  const creating = signal(false);
  const store = {
    registrationOptions: signal({
      branches: [{ id: 'a', name: 'Sede A' }],
      countries: ['CO'],
      documentTypes: [{ code: 'CC', name: 'Cédula de Ciudadanía' }],
    }),
    loadRegistrationOptions: vi.fn(),
    creating,
    created,
    optionsError: signal(false),
    optionsLoading: signal(false),
    createError: signal(null),
    create: vi.fn().mockResolvedValue(null),
  };
  const principal: Principal = {
    id: 'test',
    displayName: 'Prueba',
    roles: [],
    grants: [{ permission: 'PERSON_CREATE', scope: { kind: 'sites', ids: ['a'] } }],
  };
  beforeEach(() => {
    session.set({ userId: 'test' });
    creating.set(false);
    store.create.mockClear();
    TestBed.configureTestingModule({
      imports: [PersonRegistrationPage],
      providers: [
        provideRouter([]),
        { provide: MembersStore, useValue: store },
        { provide: AUTH_PRINCIPAL, useValue: signal(principal) },
        { provide: AuthStore, useValue: { session, authenticated: computed(() => !!session()) } },
      ],
    }).overrideComponent(PersonRegistrationPage, {
      set: { providers: [ConfirmationService, { provide: MembersStore, useValue: store }] },
    });
  });
  function page() {
    const fixture = TestBed.createComponent(PersonRegistrationPage);
    fixture.detectChanges();
    return fixture;
  }
  it('asigna sede única sin BRANCH_VIEW y no admite campos obligatorios vacíos', async () => {
    const fixture = page();
    const component = fixture.componentInstance;
    expect(component.form.controls.branchId.value).toBe('a');
    expect(component.form.invalid).toBe(true);
    await component.submit();
    expect(store.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Sede A');
    expect(fixture.nativeElement.textContent).not.toContain('Estado inicial');
    expect(fixture.nativeElement.querySelector('[formControlName="issuingCountry"]')).toBeNull();
  });
  it('normaliza y conserva ceros iniciales, acentos y contacto opcional', async () => {
    const component = page().componentInstance;
    component.form.patchValue({
      firstNames: ' Ángela María ',
      lastNames: ' De la Cruz ',
      documentType: ' cc ',
      issuingCountry: 'co',
      documentNumber: ' 000123 ',
      phone: '5700123',
      email: '',
      birthDate: new Date(1990, 0, 1),
    });
    await component.submit();
    const request = store.create.mock.calls[0][0];
    expect(request.person).toEqual({
      firstNames: 'Ángela María',
      lastNames: 'De la Cruz',
      phone: '5700123',
      email: null,
      birthDate: '1990-01-01',
    });
    expect(request.document).toEqual({
      documentType: 'CC',
      issuingCountry: 'CO',
      documentNumber: '000123',
    });
  });
  it('rechaza correo inválido, texto en blanco y fechas futuras', () => {
    const component = page().componentInstance;
    component.form.controls.email.setValue('invalid');
    expect(component.form.controls.email.invalid).toBe(true);
    component.form.controls.email.setValue(' person@example.invalid ');
    expect(component.form.controls.email.invalid).toBe(false);
    component.form.controls.firstNames.setValue('  ');
    expect(component.form.controls.firstNames.invalid).toBe(true);
    expect(validBirthDate(new FormControl(new Date(2999, 0, 1)))).toEqual({ future: true });
    expect(birthDateValue(new Date(1990, 0, 1))).toBe('1990-01-01');
  });
  it('impide guardar documento o telefono con letras y correo mal formado', async () => {
    const component = page().componentInstance;
    component.form.patchValue({
      firstNames: 'Ana',
      lastNames: 'Perez',
      documentType: 'CC',
      documentNumber: '00123',
      phone: '3001234567',
    });
    for (const values of [
      { documentNumber: '12A3', phone: '3001234567', email: '' },
      { documentNumber: '00123', phone: '+57 300', email: '' },
      { documentNumber: '00123', phone: '3001234567', email: 'correo-invalido' },
    ]) {
      component.form.patchValue(values);
      await component.submit();
      expect(store.create).not.toHaveBeenCalled();
    }
    component.form.patchValue({ phone: '', email: ' persona@example.com ' });
    expect(component.form.valid).toBe(true);
  });
  it('limpia el borrador al perder sesión y permite abandonar', () => {
    const fixture = page();
    const component = fixture.componentInstance;
    component.form.controls.firstNames.setValue('Sensitive');
    component.form.markAsDirty();
    session.set(null);
    fixture.detectChanges();
    expect(component.form.controls.firstNames.value).toBeNull();
    expect(component.canLeave()).toBe(true);
  });
  it('bloquea abandono mientras espera la confirmación del servidor', () => {
    const component = page().componentInstance;
    creating.set(true);
    expect(component.canLeave()).toBe(false);
  });
});
