import { PaginatorState } from 'primeng/paginator';
import { TablePagination, tablePageSize } from '../../shared/ui/table-pagination';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, map, merge, of, switchMap, timer } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { LucidePlus, LucideSearch, LucideEye, LucidePencil } from '@lucide/angular';
import { AuthStore } from '../../core/auth/auth.store';
import { PageHeading } from '../../shared/ui/page-heading';
import { BranchesStore } from './branches.store';
import { BranchCreateDialog } from './branch-create-dialog';
import { BranchDetailDialog } from './branch-detail-dialog';
import { BranchEditDialog } from './branch-edit-dialog';

type DialogSelection = { mode: 'create' | 'detail' | 'edit'; id?: string };
@Component({
  selector: 'app-sites-page',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TablePagination,
    ToastFeedback,
    PageHeading,
    LucidePlus,
    LucideSearch,
    LucideEye,
    LucidePencil,
    BranchCreateDialog,
    BranchDetailDialog,
    BranchEditDialog,
  ],
  providers: [BranchesStore],
  templateUrl: './sites-page.html',
  styleUrls: ['../training/catalog.scss', './sites-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SitesPage {
  readonly store = inject(BranchesStore);
  readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private opener: HTMLElement | null = null;
  private readonly createDialog = viewChild(BranchCreateDialog);
  private readonly editDialog = viewChild(BranchEditDialog);
  readonly mode = this.route.snapshot.data['branchMode'] as 'list' | 'create' | 'detail' | 'edit';
  readonly dialog = signal<DialogSelection | null>(
    this.mode === 'list'
      ? null
      : { mode: this.mode, id: this.route.snapshot.paramMap.get('id') ?? undefined },
  );
  readonly global = computed(
    () =>
      this.auth
        .session()
        ?.grants.some((g) => g.roleCode === 'SUPER_ADMIN' && g.branchId === null) ?? false,
  );
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly states = [
    { name: 'Todos', value: '' },
    { name: 'Activas', value: 'true' },
    { name: 'Inactivas', value: 'false' },
  ];
  readonly filters = this.fb.nonNullable.group({ search: [''], active: [''] });
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.pageSize.set(tablePageSize(params.get('pageSize')));
      this.page.set(Math.min(100000, Math.max(1, Number(params.get('page')) || 1)));
      this.filters.setValue(
        {
          search: (params.get('search') ?? '').slice(0, 150),
          active: ['true', 'false'].includes(params.get('active') ?? '')
            ? params.get('active')!
            : '',
        },
        { emitEvent: false },
      );
      this.reload();
    });
    merge(
      this.filters.controls.search.valueChanges.pipe(map(() => 3000)),
      this.filters.controls.active.valueChanges.pipe(map(() => 0)),
      this.route.queryParamMap.pipe(map(() => null)),
    )
      .pipe(
        switchMap((delay) => (delay === null ? EMPTY : delay === 0 ? of(0) : timer(delay))),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.search(1, true));
    let identity = JSON.stringify(this.auth.session());
    effect(() => {
      const next = JSON.stringify(this.auth.session());
      if (next !== identity) {
        identity = next;
        this.dialog.set(null);
      }
    });
    effect(() => {
      if (!this.dialog() && !this.store.loading().list && this.opener) {
        const target = this.opener;
        this.opener = null;
        afterNextRender(
          () => {
            if (target.isConnected) target.focus();
          },
          { injector: this.injector },
        );
      }
    });
  }
  reload() {
    const value = this.filters.getRawValue();
    this.store.loadList(this.page(), value.search, value.active, this.pageSize());
  }
  search(page = 1, replaceUrl = false) {
    const value = this.filters.getRawValue(),
      search = value.search.trim(),
      current = this.route.snapshot.queryParamMap;
    if (
      page === this.page() &&
      search === (current.get('search') ?? '').trim() &&
      value.active === (current.get('active') ?? '')
    )
      return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page,
        pageSize: this.pageSize(),
        search: search || null,
        active: value.active || null,
      },
      replaceUrl,
    });
  }
  paginationChanged(event: PaginatorState) {
    this.pageSize.set(tablePageSize(event.rows));
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        ...this.route.snapshot.queryParams,
        page: Math.floor((event.first ?? 0) / this.pageSize()) + 1,
        pageSize: this.pageSize(),
      },
    });
  }
  open(event: MouseEvent, mode: DialogSelection['mode'], id?: string) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    if (mode !== 'detail' && !this.global()) return;
    this.opener = event.currentTarget as HTMLElement;
    this.dialog.set({ mode, id });
  }
  close(refresh = false) {
    this.dialog.set(null);
    if (this.mode !== 'list')
      void this.router.navigate(['/gestion/sedes'], {
        queryParams: this.route.snapshot.queryParams,
      });
    else if (refresh) this.reload();
  }
  canLeave(): boolean | Promise<boolean> {
    return this.createDialog()?.canLeave() ?? this.editDialog()?.canLeave() ?? true;
  }
}
