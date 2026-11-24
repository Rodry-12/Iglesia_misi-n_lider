import { TablePagination, tablePageSize } from '../../shared/ui/table-pagination';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { PaginatorState } from 'primeng/paginator';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { PageHeading } from '../../shared/ui/page-heading';
import { AccessContext } from '../../core/auth/access-context';
import { CatalogStore } from './catalog.store';
import { CatalogFilters, CatalogKind, CatalogQuery } from './catalog.models';
import { CatalogErrorMessage, CatalogStateAction } from './catalog-actions';
import { CatalogFormPage } from './catalog-form-page';
import { CatalogDetailPage } from './catalog-detail-page';
import {
  LucideEye,
  LucidePencil,
  LucidePlus,
  LucideSearch,
  LucideX,
  LucideListTree,
} from '@lucide/angular';
@Component({
  selector: 'app-training-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TablePagination,
    ToastFeedback,
    PageHeading,
    CatalogErrorMessage,
    CatalogStateAction,
    CatalogFormPage,
    CatalogDetailPage,
    LucideEye,
    LucidePencil,
    LucidePlus,
    LucideSearch,
    LucideX,
    LucideListTree,
  ],
  templateUrl: './training-page.html',
  styleUrl: './catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingPage {
  readonly store = inject(CatalogStore);
  readonly access = inject(AccessContext);
  private readonly route = inject(ActivatedRoute);
  readonly kind = this.route.snapshot.data['kind'] as CatalogKind;
  readonly mode = this.route.snapshot.data['catalogMode'] as
    'create' | 'edit' | 'detail' | undefined;
  readonly segment = this.kind === 'category' ? 'categorias' : 'procesos';
  readonly formPage = viewChild(CatalogFormPage);
  canLeave(): boolean | Promise<boolean> {
    return this.formPage()?.canLeave() ?? true;
  }
  readonly items = computed(() =>
    this.kind === 'category'
      ? (this.store.categories()?.items ?? [])
      : (this.store.processes()?.items ?? []),
  );
  readonly title = this.kind === 'category' ? 'Categorías' : 'Procesos';
  readonly description =
    this.kind === 'category'
      ? 'Organiza las categorías de formación y consulta sus procesos.'
      : 'Administra los procesos ministeriales y su categoría.';
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  readonly categoryForm = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    active: new FormControl<CatalogQuery['active']>('', { nonNullable: true }),
  });
  readonly processForm = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    active: new FormControl<CatalogQuery['active']>('', { nonNullable: true }),
  });
  readonly states = [
    { label: 'Todos los estados', value: '' },
    { label: this.kind === 'category' ? 'Activa' : 'Activo', value: 'true' },
    { label: this.kind === 'category' ? 'Inactiva' : 'Inactivo', value: 'false' },
  ];
  get filterForm() {
    return this.kind === 'category' ? this.categoryForm : this.processForm;
  }
  constructor() {
    const unchangedReturn =
      this.router.currentNavigation()?.extras.state?.['catalogUnchangedReturn'] === this.kind;
    this.store.notice.set(null);
    this.store.commandError.set(null);
    for (const kind of ['category', 'process'] as const) {
      const form = kind === 'category' ? this.categoryForm : this.processForm;
      form.controls.search.valueChanges
        .pipe(debounceTime(2000), distinctUntilChanged(), takeUntilDestroyed(this.destroy))
        .subscribe(() => this.apply(kind));
      form.controls.active.valueChanges
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe(() => this.apply(kind));
    }
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      const number = (key: string, fallback: number, max: number) => {
        const n = Number(params.get(key));
        return Number.isInteger(n) && n > 0 && n <= max ? n : fallback;
      };
      const active = (key: string): CatalogQuery['active'] =>
        params.get(key) === 'true' ? 'true' : params.get(key) === 'false' ? 'false' : '';
      const filters: CatalogFilters = {
        categories: {
          page: number('categoryPage', 1, 1000000),
          pageSize: tablePageSize(params.get('categoryPageSize')),
          search: (params.get('categorySearch') ?? '').slice(0, 150),
          active: active('categoryActive'),
        },
        processes: {
          page: number('page', 1, 1000000),
          pageSize: tablePageSize(params.get('pageSize')),
          search: (params.get('search') ?? '').slice(0, 150),
          active: active('isActive'),
          categoryId: params.get('categoryId') ?? '',
        },
      };
      this.categoryForm.setValue(
        { search: filters.categories.search, active: filters.categories.active },
        { emitEvent: false },
      );
      this.processForm.setValue(
        { search: filters.processes.search, active: filters.processes.active },
        { emitEvent: false },
      );
      // Reuse the authorized list behind a modal; its detail/form has an isolated store.
      const existing = this.kind === 'category' ? this.store.categories() : this.store.processes();
      if (
        (!this.mode && !unchangedReturn) ||
        !existing ||
        JSON.stringify(filters) !== JSON.stringify(this.store.filters())
      )
        this.store.load(filters, this.kind);
    });
  }
  apply(kind: CatalogKind): void {
    const filters = this.store.filters();
    const form = kind === 'category' ? this.categoryForm : this.processForm;
    const value = form.getRawValue();
    const key = kind === 'category' ? 'categories' : 'processes';
    this.navigate({
      ...filters,
      [key]: { ...filters[key], search: value.search.trim(), active: value.active, page: 1 },
    });
  }
  selectCategory(id: string): void {
    const filters = this.store.filters();
    this.navigate(
      { ...filters, processes: { ...filters.processes, categoryId: id, page: 1 } },
      'process',
    );
  }
  pageChanged(kind: CatalogKind, event: PaginatorState): void {
    const filters = this.store.filters();
    const key = kind === 'category' ? 'categories' : 'processes';
    const rows = event.rows ?? filters[key].pageSize;
    this.navigate({
      ...filters,
      [key]: { ...filters[key], page: Math.floor((event.first ?? 0) / rows) + 1, pageSize: rows },
    });
  }
  private navigate(filters: CatalogFilters, kind: CatalogKind = this.kind): void {
    void this.router.navigate(
      ['/gestion/formacion', kind === 'category' ? 'categorias' : 'procesos'],
      {
        queryParams: {
          categoryPage: filters.categories.page,
          categoryPageSize: filters.categories.pageSize,
          categorySearch: filters.categories.search || null,
          categoryActive: filters.categories.active || null,
          page: filters.processes.page,
          pageSize: filters.processes.pageSize,
          search: filters.processes.search || null,
          isActive: filters.processes.active || null,
          categoryId: filters.processes.categoryId || null,
        },
      },
    );
  }
}
