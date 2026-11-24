import { LucidePlus, LucideX, LucideEye, LucidePencil, LucideClipboardPlus } from '@lucide/angular';
import { AssignmentPage } from '../training/assignment-page';
import { AssignmentStore } from '../training/assignment.store';
import { Person } from './members.models';
import { TablePagination, tablePageSize } from '../../shared/ui/table-pagination';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { PersonDetailDialog } from './person-detail-dialog';
import { PersonEditPage } from './person-edit-page';
import { PersonRegistrationPage } from './person-registration-page';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { PaginatorState } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { PageHeading } from '../../shared/ui/page-heading';
import { MembersStore } from './members.store';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { identification, PeopleQuery } from './members.models';
import { AccessContext } from '../../core/auth/access-context';
import { PersonStateAction, PersonStateFeedback } from './person-state-action';
@Component({
  selector: 'app-members-page',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TableModule,
    TablePagination,
    SelectModule,
    PageHeading,
    LucidePlus,
    LucideX,
    LucideEye,
    LucidePencil,
    LucideClipboardPlus,
    AssignmentPage,
    PersonStateAction,
    PersonStateFeedback,
    ToastFeedback,
    PersonDetailDialog,
    PersonEditPage,
    PersonRegistrationPage,
  ],
  templateUrl: './members-page.html',
  providers: [AssignmentStore],
  styleUrl: './members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPage {
  readonly store = inject(MembersStore);
  readonly access = inject(AccessContext);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private opener: HTMLElement | null = null;
  private routePersonId = this.route.snapshot.paramMap.get('id');
  readonly detailId = signal<string | null>(this.routePersonId);
  readonly editId = signal<string | null>(null);
  readonly assignmentMember = signal<Person | null>(null);
  private readonly assignmentDialog = viewChild(AssignmentPage);
  canAssign(person: Person): boolean {
    return (
      !!person.branchId &&
      person.isActive &&
      person.documents.some((d) => d.isCurrent && !d.endedAt) &&
      this.access.can('PROCESS_ASSIGN', person.branchId)
    );
  }
  openAssignment(event: MouseEvent, person: Person): void {
    if (!this.canAssign(person)) return;
    this.opener = event.currentTarget as HTMLElement;
    this.assignmentMember.set(person);
  }
  closeAssignment(): void {
    this.assignmentMember.set(null);
    this.closeDetail();
  }
  private readonly editDialog = viewChild(PersonEditPage);
  readonly registrationOpened = signal(this.route.snapshot.data['personRegistration'] === true);
  private readonly registrationDialog = viewChild(PersonRegistrationPage);
  readonly identification = identification;
  readonly form = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    branchId: new FormControl<string | null>(''),
    active: new FormControl<PeopleQuery['active']>('', { nonNullable: true }),
  });
  readonly states = [
    { label: 'Todos los estados', value: '' },
    { label: 'Activo', value: 'true' },
    { label: 'Inactivo', value: 'false' },
  ];
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      this.routePersonId = params.get('id');
      const editing = this.route.snapshot.data['personEdit'] === true;
      this.detailId.set(editing ? null : this.routePersonId);
      this.editId.set(editing ? this.routePersonId : null);
      this.registrationOpened.set(this.route.snapshot.data['personRegistration'] === true);
    });
    this.form.controls.search.valueChanges
      .pipe(debounceTime(2000), distinctUntilChanged(), takeUntilDestroyed(this.destroy))
      .subscribe(() => this.filtersChanged());
    this.form.controls.branchId.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.filtersChanged());
    this.form.controls.active.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.filtersChanged());
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      const number = (key: string, fallback: number, max: number) => {
        const value = Number(params.get(key));
        return Number.isInteger(value) && value > 0 && value <= max ? value : fallback;
      };
      const active = params.get('isActive');
      const query: PeopleQuery = {
        page: number('page', 1, 1000000),
        pageSize: tablePageSize(params.get('pageSize')),
        search: (params.get('search') ?? '').trim().slice(0, 150),
        branchId: params.get('branchId') ?? '',
        active: active === 'true' || active === 'false' ? active : '',
      };
      this.form.setValue(
        { search: query.search, branchId: query.branchId, active: query.active },
        { emitEvent: false },
      );
      if (this.access.can('PERSON_VIEW')) this.store.load(query);
    });
  }
  filtersChanged(): void {
    const values = this.form.getRawValue();
    this.navigate({
      ...this.store.query(),
      page: 1,
      search: values.search.trim().slice(0, 150),
      branchId: values.branchId ?? '',
      active: values.active,
    });
  }
  clearSearch(): void {
    this.form.controls.search.setValue('', { emitEvent: false });
    this.filtersChanged();
  }
  pageChanged(event: PaginatorState): void {
    const size = event.rows ?? this.store.query().pageSize;
    this.navigate({
      ...this.store.query(),
      page: Math.floor((event.first ?? 0) / size) + 1,
      pageSize: size,
    });
  }
  openDetail(event: MouseEvent, id: string): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    this.opener = event.currentTarget as HTMLElement;
    this.detailId.set(id);
  }
  detailHref(id: string): string {
    return this.router.serializeUrl(
      this.router.createUrlTree(['/gestion/miembros', id], {
        queryParams: this.route.snapshot.queryParams,
      }),
    );
  }
  openEdit(event: MouseEvent, id: string): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    this.opener = event.currentTarget as HTMLElement;
    this.editId.set(id);
  }
  editHref(id: string): string {
    return this.router.serializeUrl(
      this.router.createUrlTree(['/gestion/miembros', id, 'editar'], {
        queryParams: this.route.snapshot.queryParams,
      }),
    );
  }
  closeEdit(saved = false): void {
    this.editId.set(null);
    this.closeDetail();
    if (saved && !this.routePersonId) this.store.load();
  }
  canLeave(): boolean | Promise<boolean> {
    return (
      this.assignmentDialog()?.canLeave() ??
      this.registrationDialog()?.canLeave() ??
      this.editDialog()?.canLeave() ??
      true
    );
  }
  registrationHref(): string {
    return this.router.serializeUrl(
      this.router.createUrlTree(['/gestion/miembros/registrar'], {
        queryParams: this.route.snapshot.queryParams,
      }),
    );
  }
  openRegistration(event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    if (!this.access.can('PERSON_CREATE')) return;
    this.opener = event.currentTarget as HTMLElement;
    this.registrationOpened.set(true);
  }
  closeRegistration(saved = false): void {
    this.registrationOpened.set(false);
    const destination = this.router.currentNavigation()?.extractedUrl.toString();
    if (destination?.startsWith('/acceso') || destination?.startsWith('/sin-acceso')) return;
    if (this.route.snapshot.data['personRegistration']) {
      void this.router.navigate(
        [this.access.can('PERSON_VIEW') ? '/gestion/miembros' : '/gestion'],
        { queryParams: this.route.snapshot.queryParams, replaceUrl: true },
      );
    } else {
      this.closeDetail();
      if (saved && this.access.can('PERSON_VIEW')) this.store.load();
    }
  }
  closeDetail(): void {
    this.detailId.set(null);
    const destination = this.router.currentNavigation()?.extractedUrl.toString();
    if (destination?.startsWith('/acceso') || destination?.startsWith('/sin-acceso')) return;
    if (this.routePersonId) {
      void this.router.navigate(['/gestion/miembros'], {
        queryParams: this.route.snapshot.queryParams,
        replaceUrl: true,
      });
    } else if (this.opener) {
      const target = this.opener;
      this.opener = null;
      afterNextRender(
        () => {
          if (target.isConnected) target.focus();
        },
        { injector: this.injector },
      );
    }
  }
  private navigate(query: PeopleQuery): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        page: query.page,
        pageSize: query.pageSize,
        search: query.search || null,
        branchId: query.branchId || null,
        isActive: query.active || null,
      },
      replaceUrl: true,
    });
  }
}
