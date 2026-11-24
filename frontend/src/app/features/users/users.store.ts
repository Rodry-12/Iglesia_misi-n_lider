import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Subscription, timeout } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { Notifications } from '../../core/notifications/notifications';
import {
  Grant,
  InviteUser,
  Page,
  UserAccount,
  UserFilters,
  UserOptions,
  UserPerson,
} from './users.models';
const base = '/api/v1/users';
type Channel = 'list' | 'detail' | 'options' | 'people';
@Injectable()
export class UsersStore {
  private readonly notifications = inject(Notifications);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  readonly list = signal<Page<UserAccount> | null>(null);
  readonly detail = signal<UserAccount | null>(null);
  readonly options = signal<UserOptions | null>(null);
  readonly people = signal<Page<UserPerson> | null>(null);
  readonly errors = signal<Partial<Record<Channel | 'command', string>>>({});
  readonly loading = signal<Partial<Record<Channel, boolean>>>({});
  readonly busy = signal(false);
  readonly notice = signal<string | null>(null);
  readonly created = signal<UserAccount | null>(null);
  private readonly reads: Partial<Record<Channel, Subscription>> = {};
  private readonly versions = { list: 0, detail: 0, options: 0, people: 0, command: 0 };
  private command?: Subscription;
  private finish?: (value: boolean) => void;
  private identity() {
    return JSON.stringify(this.auth.session());
  }
  constructor() {
    let current = this.identity();
    effect(() => {
      const next = this.identity();
      if (next !== current) {
        current = next;
        untracked(() => this.clear());
      }
    });
    inject(DestroyRef).onDestroy(() => this.clear());
  }
  clear() {
    for (const key of ['list', 'detail', 'options', 'people'] as const) {
      ++this.versions[key];
      this.reads[key]?.unsubscribe();
      this[key].set(null);
    }
    ++this.versions.command;
    this.command?.unsubscribe();
    this.finish?.(false);
    this.finish = undefined;
    this.errors.set({});
    this.loading.set({});
    this.busy.set(false);
    this.notice.set(null);
    this.created.set(null);
  }
  loadList(filters: UserFilters) {
    let params = new HttpParams().set('page', filters.page).set('pageSize', filters.pageSize ?? 10);
    for (const key of ['search', 'branchId', 'isActive'] as const)
      if (filters[key]) params = params.set(key, filters[key]);
    this.list.set(null);
    this.read<Page<UserAccount>>('list', base, (v) => this.list.set(v), params);
  }
  loadDetail(id: string) {
    this.detail.set(null);
    this.read<UserAccount>('detail', `${base}/${id}`, (v) => this.detail.set(v));
  }
  loadOptions(operation: string) {
    this.options.set(null);
    this.read<UserOptions>(
      'options',
      base + '/administration-options',
      (v) => this.options.set(v),
      new HttpParams().set('operation', operation),
    );
  }
  clearPeopleSearch() {
    ++this.versions.people;
    this.reads.people?.unsubscribe();
    this.people.set(null);
    this.errors.update((value) => ({ ...value, people: undefined }));
    this.loading.update((value) => ({ ...value, people: false }));
  }
  searchPeople(search: string, operation: string, page = 1) {
    this.people.set(null);
    this.read<Page<UserPerson>>(
      'people',
      base + '/people-options',
      (v) => this.people.set(v),
      new HttpParams().set('search', search.trim()).set('operation', operation).set('page', page),
    );
  }
  invite(body: InviteUser) {
    return this.write(
      'POST',
      base + '/invitations',
      body,
      (response) => {
        const value = response as { user: UserAccount; deliveryStatus: string };
        this.created.set(value.user);
        this.notice.set(this.delivery(value.deliveryStatus));
      },
      201,
    );
  }
  resend(id: string) {
    return this.write(
      'POST',
      `${base}/${id}/invitation`,
      {},
      (v) => this.notice.set(this.delivery((v as { deliveryStatus: string }).deliveryStatus)),
      202,
    );
  }
  update(id: string, displayName: string, personId: string | null, refresh = true) {
    return this.write('PUT', `${base}/${id}`, { displayName, personId }, () => {
      this.notice.set('Cuenta actualizada.');
      if (refresh) this.loadDetail(id);
    });
  }
  grants(id: string, grants: Grant[], refresh = true) {
    return this.write(
      'PUT',
      `${base}/${id}/grants`,
      { grants },
      () => {
        this.notice.set('Accesos actualizados y sesiones revocadas.');
        if (refresh) this.loadDetail(id);
      },
      204,
    );
  }
  active(id: string, isActive: boolean) {
    return this.write(
      'PUT',
      `${base}/${id}/active`,
      { isActive },
      () => {
        this.notice.set('Estado de cuenta actualizado y sesiones revocadas.');
        this.loadDetail(id);
      },
      204,
    );
  }
  revoke(id: string) {
    return this.write(
      'POST',
      `${base}/${id}/revoke-sessions`,
      {},
      () => this.notice.set('Sesiones e invitaciones anteriores revocadas.'),
      204,
    );
  }
  private delivery(status: string) {
    return status === 'accepted'
      ? 'Solicitud de envío aceptada; no garantiza entrega al destinatario.'
      : 'Cuenta conservada. El envío no pudo confirmarse; puedes reenviar la invitación después de un minuto.';
  }
  private read<T>(key: Channel, url: string, accept: (v: T) => void, params?: HttpParams) {
    const version = ++this.versions[key],
      identity = this.identity();
    this.reads[key]?.unsubscribe();
    this.errors.update((v) => ({ ...v, [key]: undefined }));
    if (!this.auth.authenticated()) return;
    this.loading.update((v) => ({ ...v, [key]: true }));
    this.reads[key] = this.http
      .get<T>(url, { params })
      .pipe(timeout(15000))
      .subscribe({
        next: (value) => {
          if (version !== this.versions[key] || identity !== this.identity()) return;
          accept(value);
          this.loading.update((v) => ({ ...v, [key]: false }));
        },
        error: (error) => {
          if (version !== this.versions[key] || identity !== this.identity()) return;
          const message = this.message(error);
          if (this.auth.authenticated()) {
            this.loading.update((v) => ({ ...v, [key]: false }));
            this.errors.update((v) => ({ ...v, [key]: message }));
            if (error instanceof HttpErrorResponse && error.status === 403)
              this.notifications.warn(message);
            else this.notifications.error(message);
          }
        },
      });
  }
  private write(
    method: 'POST' | 'PUT',
    url: string,
    body: unknown,
    accept: (value: unknown) => void,
    status = 200,
  ): Promise<boolean> {
    if (this.busy() || !this.auth.authenticated()) return Promise.resolve(false);
    const version = ++this.versions.command,
      identity = this.identity();
    this.busy.set(true);
    this.notice.set(null);
    this.errors.update((v) => ({ ...v, command: undefined }));
    return new Promise((resolve) => {
      this.finish = resolve;
      this.command = this.http
        .request(method, url, { body, observe: 'response' })
        .pipe(timeout(20000))
        .subscribe({
          next: (response) => {
            if (version !== this.versions.command || identity !== this.identity()) return;
            if (response.status !== status) {
              this.errors.update((v) => ({
                ...v,
                command: 'Resultado no confirmado. Consulta la cuenta antes de repetir.',
              }));
              this.busy.set(false);
              this.finish = undefined;
              resolve(false);
              return;
            }
            this.list.set(null);
            accept(response.body);
            const notice = this.notice();
            if (notice) {
              if (notice.includes('no pudo confirmarse')) this.notifications.warn(notice);
              else this.notifications.success(notice);
            }
            this.busy.set(false);
            this.finish = undefined;
            resolve(true);
          },
          error: (error) => {
            if (version !== this.versions.command || identity !== this.identity()) return;
            const message = this.message(error);
            if (this.auth.authenticated()) {
              this.errors.update((v) => ({ ...v, command: message }));
              if (error instanceof HttpErrorResponse && [403, 409, 429].includes(error.status))
                this.notifications.warn(message);
              else this.notifications.error(message);
              this.busy.set(false);
              this.finish = undefined;
            }
            resolve(false);
          },
        });
    });
  }
  private message(error: unknown) {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (status === 401) {
      this.clear();
      this.auth.expireSession();
      return '';
    }
    if (status === 403) return 'No tienes autorización para esta operación o sede.';
    if (status === 404) return 'La cuenta o persona no está disponible en tu ámbito.';
    if (status === 429) return 'Espera al menos un minuto antes de volver a solicitar el envío.';
    if (status === 409)
      return 'La cuenta o persona ya está vinculada, o los datos cambiaron. Actualiza antes de continuar.';
    if (status === 400) return 'Revisa los datos, accesos y requisitos de la persona vinculada.';
    return 'No se pudo confirmar la operación. Consulta la cuenta antes de repetir.';
  }
}
