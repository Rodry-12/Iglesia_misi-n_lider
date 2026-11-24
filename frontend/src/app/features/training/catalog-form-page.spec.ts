import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { AUTH_PRINCIPAL, Principal } from '../../core/auth/access-context';
import { AuthStore } from '../../core/auth/auth.store';
import { CatalogFormPage } from './catalog-form-page';
import { CatalogStore } from './catalog.store';
import { Category, CatalogKind } from './catalog.models';
const category: Category = {
  id: 'a',
  name: 'Categoría',
  description: null,
  sortOrder: 0,
  isActive: true,
  createdAt: null,
  updatedAt: null,
};
describe('HU-007 formulario', () => {
  const session = signal<object | null>({ userId: 'test' });
  const principal = signal<Principal | null>(null);
  const store = {
    options: signal([category]),
    optionsLoading: signal(false),
    optionsLoaded: signal(true),
    optionsError: signal(false),
    loadOptions: vi.fn().mockResolvedValue(undefined),
    item: signal<Category | null>(null),
    detailLoading: signal(false),
    detailError: signal(null),
    commandError: signal(null),
    notice: signal(null),
    busy: signal(false),
    loadDetail: vi.fn(),
    save: vi.fn().mockResolvedValue(null),
  };
  beforeEach(() => {
    session.set({ userId: 'test' });
    principal.set({
      id: 'test',
      displayName: 'Test',
      roles: ['SUPER_ADMIN'],
      grants: [
        'CATEGORY_VIEW',
        'CATEGORY_CREATE',
        'CATEGORY_UPDATE',
        'PROCESS_CREATE',
        'PROCESS_UPDATE',
      ].map((permission) => ({
        permission: permission as
          | 'CATEGORY_VIEW'
          | 'CATEGORY_CREATE'
          | 'CATEGORY_UPDATE'
          | 'PROCESS_CREATE'
          | 'PROCESS_UPDATE',
        scope: { kind: 'all-sites' },
      })),
    });
    store.item.set(null);
    store.busy.set(false);
    store.commandError.set(null);
    store.options.set([category]);
    store.save.mockReset().mockResolvedValue(null);
  });
  function page(kind: CatalogKind = 'category', id: string | null = null) {
    TestBed.configureTestingModule({
      imports: [CatalogFormPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { kind }, queryParams: {} },
            paramMap: of(convertToParamMap(id ? { id } : {})),
          },
        },
        { provide: CatalogStore, useValue: store },
        { provide: AUTH_PRINCIPAL, useValue: principal },
        { provide: AuthStore, useValue: { session, authenticated: computed(() => !!session()) } },
      ],
    }).overrideComponent(CatalogFormPage, {
      set: { providers: [ConfirmationService, { provide: CatalogStore, useValue: store }] },
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(CatalogFormPage);
    fixture.detectChanges();
    return fixture;
  }
  it('valida campos reales y normaliza sin enviar UUID, estado ni fechas', async () => {
    const component = page().componentInstance;
    component.form.patchValue({ name: ' ', sortOrder: -1 });
    component.form.markAsDirty();
    await component.submit();
    expect(store.save).not.toHaveBeenCalled();
    component.form.patchValue({
      name: ' Ángela y formación ',
      description: ' Descripción ',
      sortOrder: 3,
    });
    await component.submit();
    expect(store.save).toHaveBeenCalledWith('category', null, {
      name: 'Ángela y formación',
      description: 'Descripción',
      sortOrder: 3,
    });
    expect(component.savedId()).toBeNull();
  });
  it('proceso exige categoría activa obtenida de la API y orden entero', async () => {
    const component = page('process').componentInstance;
    component.form.patchValue({ name: 'Proceso', categoryId: 'missing', sortOrder: 1.5 });
    component.form.markAsDirty();
    await component.submit();
    expect(store.save).not.toHaveBeenCalled();
    component.form.patchValue({ categoryId: 'a', sortOrder: 1 });
    await component.submit();
    expect(store.save).toHaveBeenCalledWith('process', null, {
      name: 'Proceso',
      description: null,
      sortOrder: 1,
      categoryId: 'a',
    });
  });
  it('precarga edición y no guarda sin cambios ni durante envío', async () => {
    const fixture = page('category', 'a');
    store.item.set(category);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.form.controls.name.value).toBe(category.name);
    expect(component.changed()).toBe(false);
    await component.submit();
    expect(store.save).not.toHaveBeenCalled();
    component.form.controls.name.setValue('Cambio');
    store.busy.set(true);
    await component.submit();
    expect(store.save).not.toHaveBeenCalled();
    expect(component.canLeave()).toBe(false);
  });
  it('permiso de sede no habilita administración global y borrar sesión elimina borrador', async () => {
    const fixture = page();
    const component = fixture.componentInstance;
    principal.update((p) => ({
      ...p!,
      grants: [{ permission: 'CATEGORY_CREATE', scope: { kind: 'sites', ids: ['a'] } }],
    }));
    fixture.detectChanges();
    component.form.controls.name.setValue('Dato');
    component.form.markAsDirty();
    await component.submit();
    expect(store.save).not.toHaveBeenCalled();
    session.set(null);
    fixture.detectChanges();
    expect(component.form.controls.name.value).toBeNull();
    expect(component.canLeave()).toBe(true);
  });
  it('confirma descarte y solo confirma guardado tras respuesta real', async () => {
    const fixture = page();
    const component = fixture.componentInstance;
    component.form.controls.name.setValue('Nueva');
    component.form.markAsDirty();
    let dialog: Confirmation | undefined;
    const service = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(service, 'confirm').mockImplementation((value) => {
      dialog = value;
      return service;
    });
    const leave = component.canLeave();
    dialog?.reject?.();
    expect(await leave).toBe(false);
    store.save.mockResolvedValue(category);
    await component.submit();
    expect(component.savedId()).toBe('a');
    expect(component.canLeave()).toBe(true);
  });
});
