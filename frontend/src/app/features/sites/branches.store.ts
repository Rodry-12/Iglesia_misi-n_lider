import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Subscription, timeout } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { Notifications } from '../../core/notifications/notifications';

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  updatedAt: string;
}
export interface BranchInput {
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  expectedUpdatedAt?: string;
}
export interface BranchAdministrator {
  userId: string;
  displayName: string;
  email: string;
  isActive: boolean;
}
export interface BranchPage<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}
type Channel = 'list' | 'detail' | 'administrators';
const base = '/api/v1/branches';

@Injectable()
export class BranchesStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  private readonly notifications = inject(Notifications);
  readonly list = signal<BranchPage<Branch> | null>(null);
  readonly detail = signal<Branch | null>(null);
  readonly administrators = signal<BranchPage<BranchAdministrator> | null>(null);
  readonly loading = signal<Partial<Record<Channel, boolean>>>({});
  readonly errors = signal<Partial<Record<Channel | 'command', string>>>({});
  readonly busy = signal(false);
  readonly notice = signal<string | null>(null);
  private reads: Partial<Record<Channel, Subscription>> = {};
  private versions = { list: 0, detail: 0, administrators: 0, command: 0 };
  private command?: Subscription;
  private finish?: (value: Branch | boolean | null) => void;
  private identity() {
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
  clear() {
    for (const key of ['list', 'detail', 'administrators'] as const) {
      ++this.versions[key];
      this.reads[key]?.unsubscribe();
      this[key].set(null);
    }
    ++this.versions.command;
    this.command?.unsubscribe();
    this.finish?.(null);
    this.finish = undefined;
    this.loading.set({});
    this.errors.set({});
    this.busy.set(false);
    this.notice.set(null);
  }
  loadList(page = 1, search = '', active = '', pageSize = 10) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search.trim()) params = params.set('search', search.trim());
    if (active) params = params.set('isActive', active);
    this.list.set(null);
    this.read<BranchPage<Branch>>('list', base, params, (value) => this.list.set(value));
  }
  loadDetail(id: string) {
    this.detail.set(null);
    this.read<Branch>('detail', `${base}/${id}`, new HttpParams(), (value) =>
      this.detail.set(value),
    );
  }
  loadAdministrators(id: string, page = 1, append = false) {
    const previous = append ? (this.administrators()?.items ?? []) : [];
    if (!append) this.administrators.set(null);
    this.read<BranchPage<BranchAdministrator>>(
      'administrators',
      `${base}/${id}/administrators`,
      new HttpParams().set('page', page).set('pageSize', 25),
      (value) => this.administrators.set({ ...value, items: [...previous, ...value.items] }),
    );
  }
  save(id: string | null, body: BranchInput): Promise<Branch | null> {
    return this.write(id ? 'PUT' : 'POST', id ? `${base}/${id}` : base, body, id ? 200 : 201).then(
      (value) => {
        if (value && typeof value === 'object') {
          this.notifications.success(id ? 'Sede actualizada.' : 'Sede creada.');
          return value;
        }
        return null;
      },
    );
  }
  async setActive(branch: Branch): Promise<boolean> {
    const result = await this.write(
      'PUT',
      `${base}/${branch.id}/active`,
      { isActive: !branch.isActive, expectedUpdatedAt: branch.updatedAt },
      204,
    );
    if (result === true) {
      this.notifications.success(branch.isActive ? 'Sede desactivada.' : 'Sede reactivada.');
      this.loadDetail(branch.id);
    }
    return result === true;
  }
  private read<T>(channel: Channel, url: string, params: HttpParams, accept: (value: T) => void) {
    const version = ++this.versions[channel],
      identity = this.identity();
    this.reads[channel]?.unsubscribe();
    this.loading.update((v) => ({ ...v, [channel]: true }));
    this.errors.update((v) => ({ ...v, [channel]: undefined }));
    this.reads[channel] = this.http
      .get<T>(url, { params })
      .pipe(timeout(30000))
      .subscribe({
        next: (value) => {
          if (version !== this.versions[channel] || identity !== this.identity()) return;
          accept(value);
          this.loading.update((v) => ({ ...v, [channel]: false }));
        },
        error: (error) => {
          if (version !== this.versions[channel] || identity !== this.identity()) return;
          const message = this.message(error);
          this.loading.update((v) => ({ ...v, [channel]: false }));
          if (this.auth.authenticated()) {
            this.errors.update((v) => ({ ...v, [channel]: message }));
            this.notifyError(error, message);
          }
        },
      });
  }
  private write(
    method: string,
    url: string,
    body: unknown,
    expected: number,
  ): Promise<Branch | boolean | null> {
    if (this.busy()) return Promise.resolve(null);
    const version = ++this.versions.command,
      identity = this.identity();
    this.busy.set(true);
    this.notice.set(null);
    this.errors.update((v) => ({ ...v, command: undefined }));
    return new Promise((resolve) => {
      this.finish = resolve;
      this.command = this.http
        .request<Branch>(method, url, { body, observe: 'response' })
        .pipe(timeout(30000))
        .subscribe({
          next: (response) => {
            if (version !== this.versions.command || identity !== this.identity()) return;
            this.busy.set(false);
            this.finish = undefined;
            if (response.status !== expected) {
              this.errors.update((v) => ({
                ...v,
                command: 'Resultado no confirmado. Consulta la sede antes de repetir.',
              }));
              this.notifications.warn(
                'Resultado no confirmado. Consulta la sede antes de repetir.',
              );
              resolve(null);
              return;
            }
            this.list.set(null);
            this.notice.set('Operación completada.');
            resolve(response.body ?? true);
          },
          error: (error) => {
            if (version !== this.versions.command || identity !== this.identity()) return;
            const message = this.message(error);
            this.busy.set(false);
            this.finish = undefined;
            if (this.auth.authenticated()) {
              this.errors.update((v) => ({ ...v, command: message }));
              this.notifyError(error, message);
            }
            resolve(null);
          },
        });
    });
  }
  private notifyError(error: unknown, message: string) {
    if (error instanceof HttpErrorResponse && [403, 409].includes(error.status))
      this.notifications.warn(message);
    else this.notifications.error(message);
  }
  private message(error: unknown): string {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (status === 401) {
      this.clear();
      this.auth.expireSession();
      return 'La sesión caducó.';
    }
    if (status === 403) return 'No tienes autorización para esta operación o sede.';
    if (status === 404) return 'La sede no está disponible en tu ámbito.';
    if (
      status === 409 &&
      error instanceof HttpErrorResponse &&
      error.error?.code === 'integrity_conflict' &&
      typeof error.error.title === 'string'
    )
      return error.error.title;
    if (status === 409)
      return 'No se pudo guardar: código duplicado, sede modificada o dependencias pendientes. Recarga la sede y revisa sus vínculos.';
    if (status === 400) return 'Revisa los datos y consulta la versión actual de la sede.';
    return 'No pudimos confirmar la operación. Consulta la sede antes de repetir.';
  }
}
