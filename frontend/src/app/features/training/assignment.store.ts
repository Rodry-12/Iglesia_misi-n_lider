import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Subscription, timeout } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import {
  Assignment,
  AssignmentOptions,
  AssignmentPeople,
  AssignmentRequest,
  AssignmentFilters,
  AssignmentFilterOptions,
  AssignmentPageResult,
  DEFAULT_ASSIGNMENT_FILTERS,
  AssignmentStateOption,
  AssignmentParticipantPage,
} from './assignment.models';

const base = '/api/v1/process-assignments';
type Channel = 'options' | 'participant' | 'responsible' | 'detail' | 'list' | 'transitions';
@Injectable()
export class AssignmentStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  private readonly reads: Partial<Record<Channel, Subscription>> = {};
  private readonly versions = {
    options: 0,
    participant: 0,
    responsible: 0,
    detail: 0,
    list: 0,
    transitions: 0,
    command: 0,
  };
  private command?: Subscription;
  private finish?: (value: Assignment | null) => void;
  readonly options = signal<AssignmentOptions | null>(null);
  readonly participant = signal<AssignmentPeople | null>(null);
  readonly responsible = signal<AssignmentPeople | null>(null);
  readonly detail = signal<Assignment | null>(null);
  readonly saved = signal<Assignment | null>(null);
  readonly transitions = signal<AssignmentStateOption[] | null>(null);
  readonly stateNotice = signal<string | null>(null);
  readonly loading = signal<Partial<Record<Channel, boolean>>>({});
  readonly errors = signal<Partial<Record<Channel | 'command', string>>>({});
  readonly busy = signal(false);
  readonly list = signal<AssignmentPageResult | null>(null);
  readonly participants = signal<AssignmentParticipantPage | null>(null);
  readonly filters = signal<AssignmentFilters>({ ...DEFAULT_ASSIGNMENT_FILTERS });
  readonly filterOptions = signal<AssignmentFilterOptions | null>(null);
  private listKey = '';
  private filterOptionsLoadedAt = 0;
  private filtersExpired(): boolean {
    return !this.filterOptions() || Date.now() - this.filterOptionsLoadedAt >= 60_000;
  }
  private acceptFilters(value: AssignmentFilterOptions | null | undefined): void {
    if (value) {
      this.filterOptions.set(value);
      this.filterOptionsLoadedAt = Date.now();
    }
  }
  private identity(): string {
    return JSON.stringify(this.auth.session());
  }
  constructor() {
    let identity = this.identity();
    effect(() => {
      const next = this.identity();
      if (next !== identity) {
        identity = next;
        untracked(() => this.clear());
      }
    });
    inject(DestroyRef).onDestroy(() => this.clear());
  }
  clear(): void {
    for (const channel of [
      'options',
      'participant',
      'responsible',
      'detail',
      'list',
      'transitions',
    ] as const) {
      ++this.versions[channel];
      this.reads[channel]?.unsubscribe();
      this[channel].set(null);
    }
    ++this.versions.command;
    this.command?.unsubscribe();
    this.finish?.(null);
    this.finish = undefined;
    this.saved.set(null);
    this.busy.set(false);
    this.loading.set({});
    this.errors.set({});
    this.filters.set({ ...DEFAULT_ASSIGNMENT_FILTERS });
    this.listKey = '';
    this.filterOptions.set(null);
    this.filterOptionsLoadedAt = 0;
    this.stateNotice.set(null);
    this.participants.set(null);
  }
  loadParticipants(filters: AssignmentFilters, force = false): void {
    const key = 'participants:' + JSON.stringify(filters);
    if (
      !force &&
      key === this.listKey &&
      (this.loading().list || (this.participants() && !this.filtersExpired()))
    )
      return;
    this.listKey = key;
    this.filters.set(filters);
    this.participants.set(null);
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize)
      .set('includeFilters', force || this.filtersExpired());
    for (const field of [
      'search',
      'branchId',
      'categoryId',
      'processId',
      'stateCode',
      'responsiblePersonId',
    ] as const)
      if (filters[field]) params = params.set(field, filters[field]);
    this.read<AssignmentParticipantPage>(
      'list',
      `${base}/participants`,
      (value) => {
        this.participants.set(value);
        this.acceptFilters(value.filters);
      },
      params,
    );
  }
  loadPersonAssignments(personId: string, page = 1, pageSize = 10): void {
    this.list.set(null);
    this.read<AssignmentPageResult>(
      'list',
      base,
      (value) => this.list.set(value),
      new HttpParams()
        .set('personId', personId)
        .set('page', page)
        .set('pageSize', pageSize)
        .set('orderByCategory', true),
    );
  }
  loadList(filters: AssignmentFilters, force = false): void {
    const key = JSON.stringify(filters);
    if (
      !force &&
      key === this.listKey &&
      (this.loading().list || (this.list() && !this.filtersExpired()))
    )
      return;
    this.listKey = key;
    this.filters.set(filters);
    this.list.set(null);
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize)
      .set('includeFilters', force || this.filtersExpired());
    for (const field of [
      'search',
      'branchId',
      'categoryId',
      'processId',
      'stateCode',
      'responsiblePersonId',
    ] as const)
      if (filters[field]) params = params.set(field, filters[field]);
    this.read<AssignmentPageResult>(
      'list',
      base,
      (value) => {
        this.list.set(value);
        this.acceptFilters(value.filters);
      },
      params,
    );
  }
  resetResponsible(): void {
    ++this.versions.responsible;
    this.reads.responsible?.unsubscribe();
    this.responsible.set(null);
    this.loading.update((v) => ({ ...v, responsible: false }));
    this.errors.update((v) => ({ ...v, responsible: undefined }));
  }
  loadOptions(): void {
    this.read<AssignmentOptions>('options', `${base}/selection-options`, (v) =>
      this.options.set(v),
    );
  }
  search(
    channel: 'participant' | 'responsible',
    search = '',
    page = 1,
    branchId?: string,
    excludePersonId?: string,
    pageSize = 10,
  ): void {
    let params = new HttpParams()
      .set('search', search.trim())
      .set('page', page)
      .set('pageSize', pageSize);
    if (branchId) params = params.set('branchId', branchId);
    if (excludePersonId) params = params.set('excludePersonId', excludePersonId);
    // Preserve the control while searching; destroying it would close an open options overlay.
    // A participant change explicitly resets the responsible channel before this query.
    this.read<AssignmentPeople>(
      channel,
      `${base}/people-options`,
      (v) => this[channel].set(v),
      params,
    );
  }
  loadDetail(id: string): void {
    this.errors.update((v) => ({ ...v, command: undefined }));
    this.resetTransitions();
    this.detail.set(null);
    this.read<Assignment>('detail', `${base}/${id}`, (v) => this.detail.set(v));
  }
  resetTransitions(): void {
    ++this.versions.transitions;
    this.reads.transitions?.unsubscribe();
    this.transitions.set(null);
    this.loading.update((v) => ({ ...v, transitions: false }));
    this.errors.update((v) => ({ ...v, transitions: undefined }));
  }
  loadTransitions(id: string): void {
    this.resetTransitions();
    this.read<AssignmentStateOption[]>(
      'transitions',
      `${base}/states`,
      (value) => this.transitions.set(value),
      new HttpParams().set('assignmentId', id),
    );
  }
  private read<T>(
    channel: Channel,
    url: string,
    accept: (value: T) => void,
    params?: HttpParams,
  ): void {
    const version = ++this.versions[channel];
    const identity = this.identity();
    this.reads[channel]?.unsubscribe();
    this.errors.update((v) => ({ ...v, [channel]: undefined }));
    this.loading.update((v) => ({ ...v, [channel]: false }));
    if (!this.auth.authenticated()) return;
    this.loading.update((v) => ({ ...v, [channel]: true }));
    this.reads[channel] = this.http
      .get<T>(url, { params })
      .pipe(timeout(15000))
      .subscribe({
        next: (value) => {
          if (identity !== this.identity() || version !== this.versions[channel]) return;
          accept(value);
          this.loading.update((v) => ({ ...v, [channel]: false }));
        },
        error: (failure: unknown) => {
          if (identity !== this.identity() || version !== this.versions[channel]) return;
          const error = this.message(failure);
          if (!this.auth.authenticated()) return;
          this.loading.update((v) => ({ ...v, [channel]: false }));
          this.errors.update((v) => ({ ...v, [channel]: error }));
        },
      });
  }
  save(body: AssignmentRequest): Promise<Assignment | null> {
    return this.write(body);
  }
  changeState(id: string, stateCode: string): Promise<Assignment | null> {
    return this.write({ stateCode }, id);
  }
  searchReplacement(id: string, search = '', page = 1, pageSize = 10): void {
    this.read<AssignmentPeople>(
      'responsible',
      `${base}/${id}/responsible-options`,
      (value) => this.responsible.set(value),
      new HttpParams().set('search', search.trim()).set('page', page).set('pageSize', pageSize),
    );
  }
  changeResponsible(
    id: string,
    responsiblePersonId: string,
    expectedResponsiblePersonId: string,
  ): Promise<Assignment | null> {
    return this.write({ responsiblePersonId, expectedResponsiblePersonId }, id, 'responsible');
  }
  private write(
    body:
      | AssignmentRequest
      | { stateCode: string }
      | { responsiblePersonId: string; expectedResponsiblePersonId: string },
    stateId?: string,
    operation: 'state' | 'responsible' = 'state',
  ): Promise<Assignment | null> {
    if (this.busy() || !this.auth.authenticated()) return Promise.resolve(null);
    const version = ++this.versions.command;
    const identity = this.identity();
    this.busy.set(true);
    this.saved.set(null);
    this.stateNotice.set(null);
    this.errors.update((v) => ({ ...v, command: undefined }));
    return new Promise((resolve) => {
      this.finish = resolve;
      const fail = (failure: unknown) => {
        if (version !== this.versions.command || identity !== this.identity()) {
          resolve(null);
          return;
        }
        const error =
          stateId &&
          operation === 'responsible' &&
          failure instanceof HttpErrorResponse &&
          failure.status === 409
            ? 'El responsable cambió o la selección dejó de ser válida. Actualiza la asignación antes de volver a intentarlo.'
            : stateId && failure instanceof HttpErrorResponse && failure.status === 409
              ? 'El estado cambió o la transición no está permitida. Vuelve a consultar la asignación antes de intentarlo de nuevo.'
              : this.message(failure, true);
        if (this.auth.authenticated()) {
          this.errors.update((v) => ({ ...v, command: error }));
          this.busy.set(false);
          this.finish = undefined;
        }
        resolve(null);
      };
      const request = stateId
        ? this.http.put<Assignment>(`${base}/${stateId}/${operation}`, body, {
            observe: 'response',
          })
        : this.http.post<Assignment>(base, body, { observe: 'response' });
      this.command = request.pipe(timeout(20000)).subscribe({
        next: (response) => {
          if (version !== this.versions.command || identity !== this.identity()) {
            resolve(null);
            return;
          }
          if (response.status !== (stateId ? 200 : 201) || !response.body) {
            fail(null);
            return;
          }
          if (stateId) {
            ++this.versions.list;
            this.reads.list?.unsubscribe();
            this.list.set(null);
            this.listKey = '';
            this.loading.update((v) => ({ ...v, list: false }));
            this.stateNotice.set(
              operation === 'state'
                ? 'Estado actualizado correctamente.'
                : 'Responsable actualizado correctamente.',
            );
            this.loadDetail(stateId);
          } else this.saved.set(response.body);
          this.busy.set(false);
          this.finish = undefined;
          resolve(response.body);
        },
        error: fail,
      });
    });
  }
  private message(failure: unknown, write = false): string {
    const status = failure instanceof HttpErrorResponse ? failure.status : 0;
    if (status === 401) {
      this.clear();
      this.auth.expireSession();
      return '';
    }
    if (status === 403) return 'No tienes permiso para esta sede u operación.';
    if (status === 404) return 'El recurso no existe o no está disponible en tu ámbito.';
    if (status === 400) return 'Revisa los campos obligatorios y las opciones seleccionadas.';
    if (status === 409)
      return 'La asignación está duplicada o alguna opción cambió. Revisa la selección antes de volver a guardar.';
    return write
      ? 'No se pudo confirmar el resultado. Consulta las asignaciones antes de volver a enviar.'
      : 'No se pudieron cargar las opciones. Inténtalo de nuevo.';
  }
}
