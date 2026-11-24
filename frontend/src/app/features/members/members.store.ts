import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Subscription, timeout } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import {
  CreatePersonRequest,
  EMPTY_QUERY,
  PeoplePage,
  PeopleQuery,
  Person,
  RegistrationOptions,
  UpdatePersonRequest,
} from './members.models';
export type MembersError = 'not-found' | 'forbidden' | 'unavailable' | null;
@Injectable()
export class MembersStore {
  private stateRequest?: Subscription;
  private finishState?: (confirmed: boolean) => void;
  private stateVersion = 0;
  private view: 'list' | 'detail' | null = null;
  private detailId = '';
  readonly changingStateId = signal<string | null>(null);
  readonly stateChanged = signal<'active' | 'inactive' | null>(null);
  readonly stateError = signal<
    'conflict' | 'invalid' | 'forbidden' | 'not-found' | 'unconfirmed' | null
  >(null);
  private updateRequest?: Subscription;
  private finishUpdate?: (person: Person | null) => void;
  private updateVersion = 0;
  readonly updating = signal(false);
  readonly updateError = signal<
    'conflict' | 'invalid' | 'forbidden' | 'not-found' | 'unconfirmed' | null
  >(null);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  private listRequest?: Subscription;
  private detailRequest?: Subscription;
  private listVersion = 0;
  private detailVersion = 0;
  private optionsRequest?: Subscription;
  private createRequest?: Subscription;
  private finishCreate?: (person: Person | null) => void;
  private optionsVersion = 0;
  private createVersion = 0;
  readonly registrationOptions = signal<RegistrationOptions | null>(null);
  readonly optionsLoading = signal(false);
  readonly optionsError = signal(false);
  readonly creating = signal(false);
  readonly created = signal<Person | null>(null);
  readonly createError = signal<'duplicate' | 'invalid' | 'forbidden' | 'unconfirmed' | null>(null);
  readonly query = signal<PeopleQuery>(EMPTY_QUERY);
  readonly page = signal<PeoplePage | null>(null);
  readonly person = signal<Person | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly error = signal<MembersError>(null);
  readonly detailError = signal<MembersError>(null);
  readonly branches = signal<PeoplePage['branches']>([]);
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
    ++this.stateVersion;
    this.stateRequest?.unsubscribe();
    this.finishState?.(false);
    this.finishState = undefined;
    this.changingStateId.set(null);
    this.stateChanged.set(null);
    this.stateError.set(null);
    this.view = null;
    this.detailId = '';
    ++this.updateVersion;
    this.updateRequest?.unsubscribe();
    this.finishUpdate?.(null);
    this.finishUpdate = undefined;
    this.updating.set(false);
    this.updateError.set(null);
    ++this.optionsVersion;
    ++this.createVersion;
    this.optionsRequest?.unsubscribe();
    this.createRequest?.unsubscribe();
    this.finishCreate?.(null);
    this.finishCreate = undefined;
    this.registrationOptions.set(null);
    this.optionsLoading.set(false);
    this.optionsError.set(false);
    this.creating.set(false);
    this.created.set(null);
    this.createError.set(null);
    ++this.listVersion;
    ++this.detailVersion;
    this.listRequest?.unsubscribe();
    this.detailRequest?.unsubscribe();
    this.page.set(null);
    this.person.set(null);
    this.branches.set([]);
    this.loading.set(false);
    this.detailLoading.set(false);
    this.error.set(null);
    this.detailError.set(null);
  }
  loadRegistrationOptions(): void {
    this.optionsRequest?.unsubscribe();
    const version = ++this.optionsVersion;
    const identity = this.identity();
    this.registrationOptions.set(null);
    this.created.set(null);
    this.createError.set(null);
    this.optionsError.set(false);
    if (!this.auth.authenticated()) return;
    this.optionsLoading.set(true);
    this.optionsRequest = this.http
      .get<RegistrationOptions>('/api/v1/people/registration-options')
      .pipe(timeout(10000))
      .subscribe({
        next: (options) => {
          if (version !== this.optionsVersion || identity !== this.identity()) return;
          this.registrationOptions.set(options);
          this.optionsLoading.set(false);
        },
        error: (error: unknown) => {
          if (version !== this.optionsVersion || identity !== this.identity()) return;
          this.optionsLoading.set(false);
          this.optionsError.set(true);
          if (error instanceof HttpErrorResponse && error.status === 401) this.auth.expireSession();
        },
      });
  }
  async create(request: CreatePersonRequest): Promise<Person | null> {
    if (this.creating() || this.updating() || this.changingStateId() || !this.auth.authenticated())
      return null;
    const version = ++this.createVersion;
    const identity = this.identity();
    this.creating.set(true);
    this.createError.set(null);
    this.created.set(null);
    return new Promise((resolve) => {
      this.finishCreate = resolve;
      this.createRequest = this.http
        .post<Person>('/api/v1/people', request)
        .pipe(timeout(20000))
        .subscribe({
          next: (person) => {
            if (version !== this.createVersion || identity !== this.identity()) {
              resolve(null);
              return;
            }
            // Invalidate every HU-001 request/result so an old response cannot restore a stale list.
            ++this.listVersion;
            this.listRequest?.unsubscribe();
            this.page.set(null);
            this.loading.set(false);
            this.created.set(person);
            this.creating.set(false);
            this.finishCreate = undefined;
            resolve(person);
          },
          error: (error: unknown) => {
            if (version !== this.createVersion || identity !== this.identity()) {
              resolve(null);
              return;
            }
            this.creating.set(false);
            this.finishCreate = undefined;
            const status = error instanceof HttpErrorResponse ? error.status : 0;
            if (status === 401) this.auth.expireSession();
            else
              this.createError.set(
                status === 409
                  ? 'duplicate'
                  : status === 400
                    ? 'invalid'
                    : status === 403
                      ? 'forbidden'
                      : 'unconfirmed',
              );
            resolve(null);
          },
        });
    });
  }
  async update(id: string, request: UpdatePersonRequest): Promise<Person | null> {
    if (this.updating() || this.creating() || this.changingStateId() || !this.auth.authenticated())
      return null;
    const version = ++this.updateVersion;
    const identity = this.identity();
    this.updating.set(true);
    this.updateError.set(null);
    return new Promise((resolve) => {
      this.finishUpdate = resolve;
      this.updateRequest = this.http
        .put<Person>(`/api/v1/people/${id}`, request)
        .pipe(timeout(20000))
        .subscribe({
          next: (person) => {
            if (version !== this.updateVersion || identity !== this.identity()) {
              resolve(null);
              return;
            }
            ++this.listVersion;
            ++this.detailVersion;
            this.listRequest?.unsubscribe();
            this.detailRequest?.unsubscribe();
            this.page.set(null);
            this.loading.set(false);
            this.detailLoading.set(false);
            this.person.set(person);
            this.updating.set(false);
            this.finishUpdate = undefined;
            resolve(person);
          },
          error: (error: unknown) => {
            if (version !== this.updateVersion || identity !== this.identity()) {
              resolve(null);
              return;
            }
            this.updating.set(false);
            this.finishUpdate = undefined;
            const status = error instanceof HttpErrorResponse ? error.status : 0;
            if (status === 401) {
              this.clear();
              this.auth.expireSession();
            } else
              this.updateError.set(
                status === 409
                  ? 'conflict'
                  : status === 400
                    ? 'invalid'
                    : status === 403
                      ? 'forbidden'
                      : status === 404
                        ? 'not-found'
                        : 'unconfirmed',
              );
            resolve(null);
          },
        });
    });
  }
  async setActive(id: string, isActive: boolean): Promise<boolean> {
    if (this.changingStateId() || this.creating() || this.updating() || !this.auth.authenticated())
      return false;
    const version = ++this.stateVersion;
    const identity = this.identity();
    this.changingStateId.set(id);
    this.stateChanged.set(null);
    this.stateError.set(null);
    return new Promise((resolve) => {
      this.finishState = resolve;
      const fail = (error: unknown) => {
        if (version !== this.stateVersion || identity !== this.identity()) {
          resolve(false);
          return;
        }
        this.changingStateId.set(null);
        this.finishState = undefined;
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        if (status === 401) {
          this.clear();
          this.auth.expireSession();
        } else
          this.stateError.set(
            status === 409
              ? 'conflict'
              : status === 400
                ? 'invalid'
                : status === 403
                  ? 'forbidden'
                  : status === 404
                    ? 'not-found'
                    : 'unconfirmed',
          );
        resolve(false);
      };
      this.stateRequest = this.http
        .put<void>(`/api/v1/people/${id}/active`, { isActive }, { observe: 'response' })
        .pipe(timeout(20000))
        .subscribe({
          next: (response) => {
            if (version !== this.stateVersion || identity !== this.identity()) {
              resolve(false);
              return;
            }
            if (response.status !== 204) {
              fail(null);
              return;
            }
            ++this.listVersion;
            ++this.detailVersion;
            this.listRequest?.unsubscribe();
            this.detailRequest?.unsubscribe();
            this.page.set(null);
            this.person.set(null);
            this.loading.set(false);
            this.detailLoading.set(false);
            this.changingStateId.set(null);
            this.finishState = undefined;
            this.stateChanged.set(isActive ? 'active' : 'inactive');
            // Read the persisted state/version instead of inventing a timestamp from a 204 response.
            if (this.view === 'list') this.load();
            else if (this.view === 'detail') this.loadPerson(this.detailId);
            resolve(true);
          },
          error: fail,
        });
    });
  }
  load(query: PeopleQuery = this.query()): void {
    this.view = 'list';
    this.query.set(query);
    this.listRequest?.unsubscribe();
    const version = ++this.listVersion;
    const identity = this.identity();
    this.error.set(null);
    this.page.set(null);
    if (!this.auth.authenticated()) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.search) params = params.set('search', query.search.trim());
    if (query.branchId) params = params.set('branchId', query.branchId);
    if (query.active) params = params.set('isActive', query.active);
    this.listRequest = this.http
      .get<PeoplePage>('/api/v1/people', { params })
      .pipe(timeout(10000))
      .subscribe({
        next: (page) => {
          if (version !== this.listVersion || identity !== this.identity()) return;
          this.page.set(page);
          this.branches.set(page.branches);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          if (version !== this.listVersion || identity !== this.identity()) return;
          this.loading.set(false);
          this.error.set(this.readError(error));
        },
      });
  }
  loadPerson(id: string): void {
    this.view = 'detail';
    this.detailId = id;
    this.detailRequest?.unsubscribe();
    const version = ++this.detailVersion;
    const identity = this.identity();
    this.person.set(null);
    this.detailError.set(null);
    if (!this.auth.authenticated()) {
      this.detailLoading.set(false);
      return;
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.detailError.set('not-found');
      this.detailLoading.set(false);
      return;
    }
    this.detailLoading.set(true);
    this.detailRequest = this.http
      .get<Person>(`/api/v1/people/${id}`)
      .pipe(timeout(10000))
      .subscribe({
        next: (person) => {
          if (version !== this.detailVersion || identity !== this.identity()) return;
          this.person.set(person);
          this.detailLoading.set(false);
        },
        error: (error: unknown) => {
          if (version !== this.detailVersion || identity !== this.identity()) return;
          this.detailLoading.set(false);
          this.detailError.set(this.readError(error));
        },
      });
  }
  private readError(error: unknown): MembersError {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        this.auth.expireSession();
        return null;
      }
      if (error.status === 403) return 'forbidden';
      if (error.status === 404) return 'not-found';
    }
    return 'unavailable';
  }
}
