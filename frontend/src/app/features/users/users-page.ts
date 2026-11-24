import { PaginatorState } from 'primeng/paginator';
import { TablePagination, tablePageSize } from '../../shared/ui/table-pagination';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  effect,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, map, merge, switchMap, timer } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { LucideUserPlus, LucideEye, LucidePencil } from '@lucide/angular';
import { AuthStore } from '../../core/auth/auth.store';
import { PageHeading } from '../../shared/ui/page-heading';
import { accountRoleLabel } from '../../shared/ui/account-labels';
import { UsersStore } from './users.store';
import { UserAccount, UserFilters } from './users.models';
import { userAllowed, userProtected, userRole, userStatus } from './user-access';
import { UserViewDialog } from './user-view-dialog';
import { UserEditDialog } from './user-edit-dialog';
import { UserInviteDialog } from './user-invite-dialog';
type Selection = { mode: 'view' | 'edit' | 'invite'; id?: string };
@Component({
  selector: 'app-users-page',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TableModule,
    TablePagination,
    PageHeading,
    LucideUserPlus,
    LucideEye,
    LucidePencil,
    UserViewDialog,
    UserEditDialog,
    UserInviteDialog,
  ],
  providers: [UsersStore],
  templateUrl: './users-page.html',
  styleUrls: ['../training/catalog.scss', './users-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {
  readonly store = inject(UsersStore);
  readonly auth = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly editDialog = viewChild(UserEditDialog);
  private readonly inviteDialog = viewChild(UserInviteDialog);
  private opener: HTMLElement | null = null;
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly inviting = this.route.snapshot.data['invite'] === true;
  readonly dialog = signal<Selection | null>(
    this.inviting
      ? { mode: 'invite' }
      : this.id
        ? { mode: this.route.snapshot.data['userEdit'] ? 'edit' : 'view', id: this.id }
        : null,
  );
  readonly activeOptions = [
    { name: 'Todos', value: '' },
    { name: 'Activa', value: 'true' },
    { name: 'Inactiva', value: 'false' },
  ];
  readonly filters = this.fb.nonNullable.group({ search: [''], branchId: [''], isActive: [''] });
  readonly filterValue = signal<UserFilters>({ page: 1, search: '', branchId: '', isActive: '' });
  constructor() {
    if (this.allowed('USER_VIEW')) {
      this.store.loadOptions('USER_VIEW');
      this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
        const value = {
          pageSize: tablePageSize(params.get('pageSize')),
          page: Math.min(100000, Math.max(1, Number(params.get('page')) || 1)),
          search: (params.get('search') ?? '').slice(0, 150),
          branchId: params.get('branchId') ?? '',
          isActive: ['true', 'false'].includes(params.get('isActive') ?? '')
            ? params.get('isActive')!
            : '',
        };
        this.filterValue.set(value);
        this.filters.patchValue(value, { emitEvent: false });
        this.store.loadList(value);
      });
      merge(
        this.filters.controls.search.valueChanges.pipe(map(() => 3000)),
        this.filters.controls.branchId.valueChanges.pipe(map(() => 350)),
        this.filters.controls.isActive.valueChanges.pipe(map(() => 350)),
        this.route.queryParamMap.pipe(map(() => null)),
      )
        .pipe(
          switchMap((delay) => (delay === null ? EMPTY : timer(delay))),
          takeUntilDestroyed(),
        )
        .subscribe(() => this.page(1));
    }
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
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    const editor = this.editDialog()?.editor ?? this.inviteDialog()?.editor;
    if (editor && (editor.form.dirty || editor.store.busy())) event.preventDefault();
  }
  allowed(permission: string, user?: UserAccount) {
    return userAllowed(this.auth.session(), this.store.options(), permission, user);
  }
  canEdit(user: UserAccount) {
    return (
      this.allowed('USER_UPDATE', user) ||
      (this.allowed('USER_ASSIGN_ROLE', user) &&
        !userProtected(this.auth.session(), this.store.options(), user)) ||
      this.allowed('USER_CHANGE_STATUS', user) ||
      (this.allowed('USER_CREATE', user) &&
        user.isActive &&
        !user.hasPassword &&
        !user.emailConfirmed)
    );
  }
  displayRole(id: string) {
    return accountRoleLabel(userRole(this.store.options(), id));
  }
  branch(id: string | null) {
    return id
      ? (this.store.options()?.branches.find((b) => b.id === id)?.name ?? 'Sede no disponible')
      : 'Global';
  }
  status(user: UserAccount) {
    return userStatus(user);
  }
  page(page: number) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...this.filters.getRawValue(),
        pageSize: this.filterValue().pageSize ?? 10,
        page,
      },
      replaceUrl: true,
    });
  }
  paginationChanged(event: PaginatorState) {
    const pageSize = tablePageSize(event.rows);
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: {
        ...this.filters.getRawValue(),
        pageSize,
        page: Math.floor((event.first ?? 0) / pageSize) + 1,
      },
    });
  }
  open(event: MouseEvent, mode: Selection['mode'], id?: string) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    if (mode === 'invite' && !this.allowed('USER_CREATE')) return;
    this.opener = event.currentTarget as HTMLElement;
    this.dialog.set({ mode, id });
  }
  close(notice?: string) {
    this.dialog.set(null);
    const destination = this.router.currentNavigation()?.extractedUrl.toString();
    if (destination?.startsWith('/sin-acceso') || destination?.startsWith('/acceso')) return;
    if (this.id || this.inviting) {
      void this.router.navigate([this.allowed('USER_VIEW') ? '/gestion/usuarios' : '/gestion'], {
        queryParams: this.route.snapshot.queryParams,
      });
    } else if (notice) {
      this.store.notice.set(notice);
      this.store.loadList(this.filterValue());
    }
  }
  canLeave() {
    return this.editDialog()?.canLeave() ?? this.inviteDialog()?.canLeave() ?? true;
  }
}
