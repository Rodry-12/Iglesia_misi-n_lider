import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Confirmation, ConfirmationService } from 'primeng/api';
import { AUTH_PRINCIPAL, Principal } from '../../core/auth/access-context';
import { AuthStore } from '../../core/auth/auth.store';
import { AssignmentStore } from './assignment.store';
import { AssignmentPage } from './assignment-page';
import { Assignment, AssignmentStateOption } from './assignment.models';
const base = '/api/v1/process-assignments';
const assignment: Assignment = {
  id: 'assignment',
  personId: 'p',
  processId: 'process',
  responsiblePersonId: 'r',
  branchId: 'a',
  stateCode: 'IN_PROGRESS',
  stateName: 'En curso',
  personName: 'Persona',
  assignedAt: '2026-11-07T10:00:00Z',
  startedAt: '2026-11-07T10:01:00Z',
  finishedAt: null,
};
const target = { id: 'terminal', code: 'COMPLETED', name: 'Completado', isFinal: true };
describe('HU-010 AssignmentStore', () => {
  const session = signal<object | null>({ userId: 'u' });
  const auth = {
    session,
    authenticated: () => !!session(),
    expireSession: vi.fn(() => session.set(null)),
  };
  let store: AssignmentStore;
  let http: HttpTestingController;
  beforeEach(() => {
    session.set({ userId: 'u' });
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
    store.detail.set(assignment);
  });
  afterEach(() => http.verify());
  it('consulta transiciones del backend sin definir estados en Angular', () => {
    store.loadTransitions(assignment.id);
    const read = http.expectOne((r) => r.url === base + '/states');
    expect(read.request.params.get('assignmentId')).toBe(assignment.id);
    read.flush([target]);
    expect(store.transitions()).toEqual([target]);
    store.loadDetail(assignment.id);
    expect(store.transitions()).toBeNull();
    http.expectOne(base + '/' + assignment.id).flush(assignment);
  });
  it('PUT solo envía stateCode, impide doble envío y recarga detalle tras200', async () => {
    const pending = store.changeState(assignment.id, target.code);
    expect(await store.changeState(assignment.id, target.code)).toBeNull();
    expect(store.detail()).toEqual(assignment);
    const request = http.expectOne(base + '/' + assignment.id + '/state');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ stateCode: target.code });
    const updated = { ...assignment, stateCode: target.code, finishedAt: '2026-11-07T10:02:00Z' };
    request.flush(updated);
    expect(await pending).toEqual(updated);
    expect(store.stateNotice()).toBeTruthy();
    expect(store.list()).toBeNull();
    http.expectOne(base + '/' + assignment.id).flush(updated);
    expect(store.detail()?.finishedAt).toBe(updated.finishedAt);
  });
  it.each([400, 403, 404, 409, 503])(
    'HTTP %s conserva estado anterior sin éxito falso ni reenvío',
    async (status) => {
      const pending = store.changeState(assignment.id, target.code);
      http
        .expectOne(base + '/' + assignment.id + '/state')
        .flush({}, { status, statusText: 'Failure' });
      expect(await pending).toBeNull();
      expect(store.detail()).toEqual(assignment);
      expect(store.stateNotice()).toBeNull();
      expect(store.errors().command).toBeTruthy();
    },
  );
  it('401 cancela transiciones y elimina detalle, aviso y selección de sesión', async () => {
    store.loadTransitions(assignment.id);
    const read = http.expectOne((r) => r.url.endsWith('/states'));
    const pending = store.changeState(assignment.id, target.code);
    http
      .expectOne(base + '/' + assignment.id + '/state')
      .flush({}, { status: 401, statusText: 'Expired' });
    expect(await pending).toBeNull();
    expect(read.cancelled).toBe(true);
    expect(auth.expireSession).toHaveBeenCalled();
    expect(store.detail()).toBeNull();
    expect(store.transitions()).toBeNull();
  });
  it('cancelación por cambio de identidad resuelve comando sin restaurar datos', async () => {
    const pending = store.changeState(assignment.id, target.code);
    const command = http.expectOne(base + '/' + assignment.id + '/state');
    session.set({ userId: 'other' });
    TestBed.tick();
    expect(await pending).toBeNull();
    expect(command.cancelled).toBe(true);
    expect(store.stateNotice()).toBeNull();
  });
});
describe('HU-010 confirmación y permiso en ficha existente', () => {
  const session = signal<object | null>({ userId: 'u' });
  const principal = signal<Principal | null>(null);
  const store = {
    clear: vi.fn(),
    loadDetail: vi.fn(),
    loadTransitions: vi.fn(),
    resetTransitions: vi.fn(),
    detail: signal<Assignment | null>(assignment),
    transitions: signal<AssignmentStateOption[] | null>([target]),
    busy: signal(false),
    saved: signal(null),
    errors: signal({}),
    loading: signal({}),
    stateNotice: signal(null),
    changeState: vi.fn().mockResolvedValue(assignment),
  };
  beforeEach(() => {
    session.set({ userId: 'u' });
    principal.set({
      id: 'u',
      displayName: 'Usuario',
      roles: ['OPERATOR'],
      grants: [{ permission: 'PROCESS_CHANGE_STATUS', scope: { kind: 'sites', ids: ['a'] } }],
    });
    store.detail.set(assignment);
    store.transitions.set([target]);
    store.busy.set(false);
    store.changeState.mockClear();
    store.loadTransitions.mockClear();
    TestBed.configureTestingModule({
      imports: [AssignmentPage],
      providers: [
        provideRouter([]),
        { provide: AssignmentStore, useValue: store },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: assignment.id }), queryParams: {} },
          },
        },
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
  it('finalización exige confirmación explícita y cancelarla no escribe', async () => {
    const fixture = page();
    const component = fixture.componentInstance;
    expect(store.loadTransitions).toHaveBeenCalledWith(assignment.id);
    component.stateForm.controls.stateCode.setValue(target.code);
    const service = fixture.debugElement.injector.get(ConfirmationService);
    let dialog: Confirmation | undefined;
    vi.spyOn(service, 'confirm').mockImplementation((value) => {
      dialog = value;
      return service;
    });
    const cancelled = component.changeState();
    expect(store.changeState).not.toHaveBeenCalled();
    expect(dialog?.acceptLabel).toBe('Confirmar finalización');
    await component.changeState();
    dialog?.reject?.();
    await cancelled;
    expect(store.changeState).not.toHaveBeenCalled();
    const confirmed = component.changeState();
    dialog?.accept?.();
    await confirmed;
    expect(store.changeState).toHaveBeenCalledExactlyOnceWith(assignment.id, target.code);
  });
  it('solo VIEW o CHANGE en otra sede no habilita la acción', async () => {
    const fixture = page();
    const component = fixture.componentInstance;
    for (const grant of [
      { permission: 'PROCESS_VIEW' as const, scope: { kind: 'sites' as const, ids: ['a'] } },
      {
        permission: 'PROCESS_CHANGE_STATUS' as const,
        scope: { kind: 'sites' as const, ids: ['b'] },
      },
    ]) {
      principal.update((p) => ({ ...p!, grants: [grant] }));
      fixture.detectChanges();
      component.stateForm.controls.stateCode.setValue(target.code);
      await component.changeState();
      expect(component.canChangeState()).toBe(false);
      expect(store.changeState).not.toHaveBeenCalled();
    }
  });
  it('estado sin transiciones no presenta guardado ni permite códigos inventados', async () => {
    const fixture = page();
    store.transitions.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay cambios de estado disponibles');
    fixture.componentInstance.stateForm.controls.stateCode.setValue('FORGED');
    await fixture.componentInstance.changeState();
    expect(store.changeState).not.toHaveBeenCalled();
  });
  it('pérdida de sesión resuelve y cancela confirmación sin escribir', async () => {
    const fixture = page();
    const component = fixture.componentInstance;
    component.stateForm.controls.stateCode.setValue(target.code);
    const service = fixture.debugElement.injector.get(ConfirmationService);
    vi.spyOn(service, 'confirm').mockImplementation(() => service);
    const pending = component.changeState();
    session.set(null);
    fixture.detectChanges();
    await pending;
    expect(store.changeState).not.toHaveBeenCalled();
    expect(component.stateForm.controls.stateCode.value).toBe('');
  });
  it('bloquea navegación durante la escritura incluso desde detalle', () => {
    const fixture = page();
    store.busy.set(true);
    expect(fixture.componentInstance.canLeave()).toBe(false);
  });
});
