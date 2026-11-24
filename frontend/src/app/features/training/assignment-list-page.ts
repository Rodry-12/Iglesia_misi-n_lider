import { TablePagination, tablePageSize } from '../../shared/ui/table-pagination';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  untracked,
  signal,
  afterNextRender,
  Injector,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { PaginatorState } from 'primeng/paginator';
import { AccessContext } from '../../core/auth/access-context';
import { PageHeading } from '../../shared/ui/page-heading';
import { AssignmentStore } from './assignment.store';
import { AssignmentFilters, DEFAULT_ASSIGNMENT_FILTERS } from './assignment.models';
import { LucideSearch, LucideX, LucideEye, LucidePencil } from '@lucide/angular';
import { ParticipantProcessesDialog } from './participant-processes-dialog';
import { AssignmentParticipant } from './assignment.models';
@Component({
  selector: 'app-assignment-list',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TableModule,
    ToastFeedback,
    TablePagination,
    PageHeading,
    LucideSearch,
    LucideX,
    LucideEye,
    LucidePencil,
    ParticipantProcessesDialog,
  ],
  templateUrl: './assignment-list-page.html',
  styleUrls: ['./catalog.scss', './assignment-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignmentListPage {
  readonly store = inject(AssignmentStore);
  readonly access = inject(AccessContext);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  readonly selected = signal<AssignmentParticipant | null>(null);
  readonly editMode = signal(false);
  private opener: HTMLElement | null = null;
  openProcesses(event: MouseEvent, person: AssignmentParticipant, edit = false): void {
    this.opener = event.currentTarget as HTMLElement;
    this.editMode.set(edit);
    this.selected.set(person);
  }
  canEdit(person: AssignmentParticipant): boolean {
    return person.branches.some(
      (b) =>
        this.access.can('PROCESS_CHANGE_STATUS', b.id) ||
        this.access.can('PROCESS_CHANGE_RESPONSIBLE', b.id),
    );
  }
  closeDetail(): void {
    this.selected.set(null);
    const opener = this.opener;
    this.opener = null;
    afterNextRender(
      () => {
        if (opener?.isConnected) opener.focus();
      },
      { injector: this.injector },
    );
  }
  readonly form = inject(FormBuilder).nonNullable.group({
    search: [''],
    branchId: [''],
    categoryId: [''],
    processId: [''],
    stateCode: [''],
    responsiblePersonId: [''],
  });
  readonly filterFields = [
    { key: 'branchId', label: 'Sede', placeholder: 'Todas las sedes' },
    { key: 'stateCode', label: 'Estado', placeholder: 'Todos los estados' },
    { key: 'categoryId', label: 'Categoría', placeholder: 'Todas las categorías' },
    { key: 'processId', label: 'Proceso', placeholder: 'Todos los procesos' },
    { key: 'responsiblePersonId', label: 'Responsable', placeholder: 'Todos los responsables' },
  ] as const;
  readonly options = computed(() => {
    const filters = this.store.filterOptions();
    return {
      branchId: filters?.branches ?? [],
      categoryId: filters?.categories ?? [],
      processId:
        filters?.processes.filter(
          (p) =>
            !!this.store.filters().categoryId && p.categoryId === this.store.filters().categoryId,
        ) ?? [],
      stateCode: filters?.states.map((s) => ({ id: s.code, name: s.name })) ?? [],
      responsiblePersonId: filters?.responsiblePeople ?? [],
    };
  });
  constructor() {
    let identity = JSON.stringify(this.access.principal());
    effect(() => {
      const next = JSON.stringify(this.access.principal());
      if (next !== identity) {
        identity = next;
        untracked(() => this.form.reset(undefined, { emitEvent: false }));
      }
    });
    this.form.controls.search.valueChanges
      .pipe(debounceTime(2000), distinctUntilChanged(), takeUntilDestroyed(this.destroy))
      .subscribe(() => this.apply());
    for (const field of this.filterFields)
      this.form.controls[field.key].valueChanges
        .pipe(takeUntilDestroyed(this.destroy))
        .subscribe(() => {
          if (field.key === 'categoryId')
            this.form.controls.processId.setValue('', { emitEvent: false });
          this.apply();
        });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      const filters = { ...DEFAULT_ASSIGNMENT_FILTERS };
      for (const field of ['page', 'pageSize'] as const) {
        const value = Number(params.get(field));
        if (Number.isInteger(value) && value > 0 && value <= (field === 'pageSize' ? 100 : 1000000))
          filters[field] = field === 'pageSize' ? tablePageSize(value) : value;
      }
      for (const field of [
        'search',
        'branchId',
        'categoryId',
        'processId',
        'stateCode',
        'responsiblePersonId',
      ] as const)
        filters[field] = (params.get(field) ?? '').slice(0, field === 'search' ? 150 : 64);
      if (!filters.categoryId) filters.processId = '';
      const { page: _page, pageSize: _pageSize, ...value } = filters;
      this.form.setValue(value, { emitEvent: false });
      this.store.loadParticipants(filters);
    });
  }
  apply(): void {
    this.navigate({
      ...this.store.filters(),
      ...this.form.getRawValue(),
      search: this.form.controls.search.value.trim(),
      page: 1,
    });
  }
  reset(): void {
    const { page: _page, pageSize: _pageSize, ...value } = DEFAULT_ASSIGNMENT_FILTERS;
    this.form.reset(value, { emitEvent: false });
    this.navigate({ ...DEFAULT_ASSIGNMENT_FILTERS, pageSize: this.store.filters().pageSize });
  }
  pageChanged(event: PaginatorState): void {
    const pageSize = event.rows ?? this.store.filters().pageSize;
    this.navigate({
      ...this.store.filters(),
      page: Math.floor((event.first ?? 0) / pageSize) + 1,
      pageSize,
    });
  }
  private navigate(filters: AssignmentFilters): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: Object.fromEntries(
        Object.entries(filters).map(([key, value]) => [key, value || null]),
      ),
    });
  }
  date(value: string | null): string {
    return value
      ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(value),
        )
      : 'Sin iniciar';
  }
}
