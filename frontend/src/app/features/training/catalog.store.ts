import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { firstValueFrom, Subject, Subscription, takeUntil, timeout } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { AccessContext } from '../../core/auth/access-context';
import {
  CatalogError,
  CatalogFilters,
  CatalogItem,
  CatalogKind,
  CatalogPage,
  CatalogRequest,
  Category,
  DEFAULT_CATALOG_FILTERS,
  MinistryProcess,
  catalogPath,
} from './catalog.models';

@Injectable()
export class CatalogStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);
  private readonly access = inject(AccessContext);
  private reads: Partial<Record<CatalogKind | 'detail', Subscription>> = {};
  private versions = { category: 0, process: 0, detail: 0, options: 0, command: 0 };
  private command?: Subscription;
  private finishCommand?: (value: CatalogItem | boolean | null) => void;
  private optionsStop = new Subject<void>();
  private view: { kind: CatalogKind; id: string } | 'list' | null = null;
  private listKind?: CatalogKind;
  readonly filters = signal<CatalogFilters>(DEFAULT_CATALOG_FILTERS);
  readonly categories = signal<CatalogPage<Category> | null>(null);
  readonly processes = signal<CatalogPage<MinistryProcess> | null>(null);
  readonly categoryLoading = signal(false);
  readonly processLoading = signal(false);
  readonly categoryError = signal<CatalogError>(null);
  readonly processError = signal<CatalogError>(null);
  readonly item = signal<CatalogItem | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<CatalogError>(null);
  readonly options = signal<Category[]>([]);
  readonly optionsLoading = signal(false);
  readonly optionsLoaded = signal(false);
  readonly optionsError = signal(false);
  readonly busy = signal(false);
  readonly commandError = signal<CatalogError>(null);
  readonly notice = signal<string | null>(null);
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
    this.invalidate();
    ++this.versions.options;
    ++this.versions.command;
    this.command?.unsubscribe();
    this.finishCommand?.(null);
    this.finishCommand = undefined;
    this.optionsStop.next();
    this.options.set([]);
    this.optionsLoading.set(false);
    this.optionsLoaded.set(false);
    this.optionsError.set(false);
    this.busy.set(false);
    this.commandError.set(null);
    this.notice.set(null);
    this.view = null;
    this.listKind = undefined;
    this.filters.set(DEFAULT_CATALOG_FILTERS);
    this.categoryError.set(null);
    this.processError.set(null);
    this.detailError.set(null);
  }
  private invalidate(): void {
    for (const key of ['category', 'process', 'detail'] as const) {
      ++this.versions[key];
      this.reads[key]?.unsubscribe();
    }
    this.categories.set(null);
    this.processes.set(null);
    this.item.set(null);
    this.categoryLoading.set(false);
    this.processLoading.set(false);
    this.detailLoading.set(false);
  }
  load(
    filters: CatalogFilters = this.filters(),
    kind: CatalogKind | undefined = this.listKind,
  ): void {
    if (kind !== this.listKind) this.invalidate();
    this.listKind = kind;
    this.view = 'list';
    this.filters.set(filters);
    if (kind !== 'process' && this.access.can('CATEGORY_VIEW')) this.loadPage('category');
    if (kind !== 'category' && this.access.can('PROCESS_VIEW')) this.loadPage('process');
  }
  private loadPage(kind: CatalogKind): void {
    const filter = kind === 'category' ? this.filters().categories : this.filters().processes;
    let params = new HttpParams().set('page', filter.page).set('pageSize', filter.pageSize);
    if (filter.search) params = params.set('search', filter.search.trim());
    if (filter.active) params = params.set('isActive', filter.active);
    if (kind === 'process' && this.filters().processes.categoryId)
      params = params.set('categoryId', this.filters().processes.categoryId);
    const loading = kind === 'category' ? this.categoryLoading : this.processLoading;
    const error = kind === 'category' ? this.categoryError : this.processError;
    const version = ++this.versions[kind];
    const identity = this.identity();
    this.reads[kind]?.unsubscribe();
    if (kind === 'category') this.categories.set(null);
    else this.processes.set(null);
    error.set(null);
    loading.set(false);
    if (!this.auth.authenticated()) return;
    loading.set(true);
    this.reads[kind] = this.http
      .get<CatalogPage<CatalogItem>>(catalogPath(kind), { params })
      .pipe(timeout(10000))
      .subscribe({
        next: (page) => {
          if (version !== this.versions[kind] || identity !== this.identity()) return;
          if (kind === 'category') this.categories.set(page);
          else this.processes.set(page as CatalogPage<MinistryProcess>);
          loading.set(false);
        },
        error: (failure: unknown) => {
          if (version !== this.versions[kind] || identity !== this.identity()) return;
          loading.set(false);
          error.set(this.classify(failure));
        },
      });
  }
  loadDetail(kind: CatalogKind, id: string): void {
    this.view = { kind, id };
    const version = ++this.versions.detail;
    const identity = this.identity();
    this.reads.detail?.unsubscribe();
    this.item.set(null);
    this.detailError.set(null);
    this.detailLoading.set(false);
    if (!this.auth.authenticated()) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      this.detailError.set('not-found');
      return;
    }
    this.detailLoading.set(true);
    this.reads.detail = this.http
      .get<CatalogItem>(`${catalogPath(kind)}/${id}`)
      .pipe(timeout(10000))
      .subscribe({
        next: (item) => {
          if (version !== this.versions.detail || identity !== this.identity()) return;
          this.item.set(item);
          this.detailLoading.set(false);
        },
        error: (failure: unknown) => {
          if (version !== this.versions.detail || identity !== this.identity()) return;
          this.detailLoading.set(false);
          this.detailError.set(this.classify(failure));
        },
      });
  }
  async loadOptions(): Promise<void> {
    this.optionsStop.next();
    const version = ++this.versions.options;
    const identity = this.identity();
    this.options.set([]);
    this.optionsLoaded.set(false);
    this.optionsError.set(false);
    this.optionsLoading.set(false);
    if (!this.auth.authenticated() || !this.access.can('CATEGORY_VIEW')) {
      this.optionsError.set(true);
      return;
    }
    this.optionsLoading.set(true);
    try {
      const items: Category[] = [];
      let page = 1;
      while (true) {
        const result = await firstValueFrom(
          this.http
            .get<CatalogPage<Category>>(catalogPath('category'), {
              params: new HttpParams().set('page', page).set('pageSize', 100).set('isActive', true),
            })
            .pipe(timeout(10000), takeUntil(this.optionsStop)),
        );
        if (version !== this.versions.options || identity !== this.identity()) return;
        items.push(...result.items);
        if (page * result.pageSize >= result.totalCount) break;
        if (!result.items.length) throw new Error('incomplete_options');
        ++page;
      }
      this.options.set([...new Map(items.map((item) => [item.id, item])).values()]);
      this.optionsLoaded.set(true);
    } catch (failure: unknown) {
      if (version === this.versions.options && identity === this.identity()) {
        if (failure instanceof HttpErrorResponse && failure.status === 401) {
          this.clear();
          this.auth.expireSession();
        } else this.optionsError.set(true);
      }
    } finally {
      if (version === this.versions.options && identity === this.identity())
        this.optionsLoading.set(false);
    }
  }
  async save(
    kind: CatalogKind,
    id: string | null,
    body: CatalogRequest,
  ): Promise<CatalogItem | null> {
    const result = await this.write(kind, id, body);
    return result && typeof result === 'object' ? result : null;
  }
  async setActive(kind: CatalogKind, id: string, active: boolean): Promise<boolean> {
    return (await this.write(kind, id, { isActive: active }, true)) === true;
  }
  private async write(
    kind: CatalogKind,
    id: string | null,
    body: CatalogRequest | { isActive: boolean },
    state = false,
  ): Promise<CatalogItem | boolean | null> {
    if (this.busy() || !this.auth.authenticated()) return null;
    const version = ++this.versions.command;
    const identity = this.identity();
    this.busy.set(true);
    this.commandError.set(null);
    this.notice.set(null);
    const url = catalogPath(kind) + (id ? `/${id}` : '') + (state ? '/active' : '');
    return new Promise((resolve) => {
      this.finishCommand = resolve;
      const request = id
        ? this.http.put<CatalogItem>(url, body, { observe: 'response' })
        : this.http.post<CatalogItem>(url, body, { observe: 'response' });
      const fail = (failure: unknown) => {
        if (version !== this.versions.command || identity !== this.identity()) {
          resolve(null);
          return;
        }
        this.busy.set(false);
        this.finishCommand = undefined;
        this.commandError.set(this.classify(failure, true));
        resolve(null);
      };
      this.command = request.pipe(timeout(20000)).subscribe({
        next: (response: HttpResponse<CatalogItem>) => {
          if (version !== this.versions.command || identity !== this.identity()) {
            resolve(null);
            return;
          }
          if (response.status !== (state ? 204 : id ? 200 : 201) || (!state && !response.body)) {
            fail(null);
            return;
          }
          const view = this.view;
          this.invalidate();
          this.busy.set(false);
          this.finishCommand = undefined;
          this.notice.set(state ? 'Estado actualizado.' : 'Cambios guardados.');
          if (!state) this.item.set(response.body);
          else if (view === 'list') this.load();
          else if (view) this.loadDetail(view.kind, view.id);
          resolve(state ? true : response.body);
        },
        error: fail,
      });
    });
  }
  private classify(error: unknown, write = false): CatalogError {
    const status = error instanceof HttpErrorResponse ? error.status : 0;
    if (status === 401) {
      this.clear();
      this.auth.expireSession();
      return null;
    }
    return status === 403
      ? 'forbidden'
      : status === 404
        ? 'not-found'
        : status === 400
          ? 'invalid'
          : status === 409
            ? 'conflict'
            : write
              ? 'unconfirmed'
              : 'unavailable';
  }
}
