import { userAllowed, userProtected, userStatus } from './user-access';
import { Injectable, DestroyRef, effect, inject, signal, computed, untracked } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../core/auth/auth.store';
import { permissionLabel } from '../../shared/ui/permission-labels';
import { accountRoleLabel } from '../../shared/ui/account-labels';
import { UsersStore } from './users.store';
import { Grant, UserAccount, UserPerson } from './users.models';

@Injectable()
export class UserAccountEditor {
  readonly store = inject(UsersStore);
  readonly auth = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly confirmation = inject(ConfirmationService);
  private readonly destroy = inject(DestroyRef);
  id: string | null = null;
  inviting = false;
  mode: 'view' | 'edit' | 'invite' = 'view';
  readonly ready = signal(false);
  readonly failed = new Subject<void>();
  readonly completed = new Subject<void>();
  readonly editing = signal<'profile' | 'grants' | 'security' | null>(null);
  readonly confirming = signal(false);
  readonly selectedPerson = signal<UserPerson | null>(null);
  readonly roleOptions = computed(() =>
    (this.store.options()?.roles ?? []).map((role) => ({
      ...role,
      label: role.code === 'OPERATOR' ? 'Acceso personalizado' : accountRoleLabel(role.code),
    })),
  );
  readonly permissionOptions = computed(() =>
    (this.store.options()?.permissions ?? []).map((p) => ({
      ...p,
      label: permissionLabel(p.code),
    })),
  );
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    displayName: ['', [Validators.required, Validators.maxLength(150)]],
    personId: [''],
    grants: this.fb.array([this.grantForm()]),
  });
  readonly document = this.fb.nonNullable.control('');
  private finishConfirmation?: (value: boolean) => void;
  constructor() {
    this.document.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.store.clearPeopleSearch();
    });
    effect(() => {
      const user = this.store.detail();
      if (user)
        untracked(() => {
          this.restore(user);
        });
    });
    effect(() => {
      if (this.store.options() && (this.inviting || this.store.detail())) {
        untracked(() => {
          const user = this.store.detail();
          if (this.mode === 'edit' && user && !this.editing()) {
            if (this.allowed('USER_UPDATE', user)) this.editing.set('profile');
            else if (this.allowed('USER_ASSIGN_ROLE', user) && !this.protectedAccount(user))
              void this.edit('grants');
            else if (this.canManageSecurity(user)) this.editing.set('security');
          }
        });
        this.ready.set(true);
      }
      if (this.store.errors().detail || (!this.ready() && this.store.errors().options))
        this.failed.next();
    });
    let identity = JSON.stringify(this.auth.session());
    effect(() => {
      const next = JSON.stringify(this.auth.session());
      if (next !== identity) {
        identity = next;
        untracked(() => {
          this.form.reset();
          this.finishConfirmation?.(false);
          this.confirmation.close();
          this.failed.next();
        });
      }
    });
    this.destroy.onDestroy(() => {
      this.finishConfirmation?.(false);
      this.confirmation.close();
      this.completed.complete();
      this.failed.complete();
    });
  }
  initialize(id: string | null, mode: 'view' | 'edit' | 'invite') {
    this.id = id;
    this.mode = mode;
    this.inviting = mode === 'invite';
    this.ready.set(false);
    this.store.clear();
    if (id) this.store.loadDetail(id);
    this.store.loadOptions(this.inviting ? 'USER_CREATE' : 'USER_VIEW');
  }
  private restore(user: UserAccount) {
    this.form.patchValue({
      email: user.email,
      displayName: user.displayName,
      personId: user.personId ?? '',
    });
    this.form.controls.grants.clear();
    for (const grant of user.grants) this.form.controls.grants.push(this.grantForm(grant));
    this.form.markAsPristine();
    this.selectedPerson.set(null);
  }
  private grantForm(value?: Grant) {
    return this.fb.nonNullable.group({
      roleId: [value?.roleId ?? '', Validators.required],
      branchId: [value?.branchId ?? ''],
      permissionIds: [value?.permissionIds ?? ([] as string[])],
    });
  }
  role(id: string) {
    return this.store.options()?.roles.find((r) => r.id === id)?.code ?? 'Rol no disponible';
  }
  displayRole(id: string) {
    return accountRoleLabel(this.role(id));
  }
  branch(id: string | null) {
    return id
      ? (this.store.options()?.branches.find((b) => b.id === id)?.name ?? 'Sede no disponible')
      : 'Global';
  }
  permission(id: string) {
    const permission = this.store.options()?.permissions.find((p) => p.id === id);
    return permission ? permissionLabel(permission.code) : 'Permiso no disponible';
  }
  allowed(permission: string, user?: UserAccount) {
    return userAllowed(this.auth.session(), this.store.options(), permission, user);
  }
  protectedAccount(user: UserAccount) {
    return userProtected(this.auth.session(), this.store.options(), user);
  }
  status(user: UserAccount) {
    return userStatus(user);
  }
  addGrant() {
    if (this.form.controls.grants.length < 20) {
      this.form.controls.grants.push(this.grantForm());
      this.form.markAsDirty();
    }
  }
  removeGrant(index: number) {
    if (this.form.controls.grants.length > 1) this.form.controls.grants.removeAt(index);
    this.form.markAsDirty();
  }
  roleChanged(index: number) {
    const group = this.form.controls.grants.at(index);
    group.controls.permissionIds.setValue([]);
    if (this.role(group.controls.roleId.value) === 'SUPER_ADMIN')
      group.controls.branchId.setValue('');
  }
  findPerson(page = 1) {
    if (this.document.value.trim().length >= 3)
      this.store.searchPeople(this.document.value, this.id ? 'USER_UPDATE' : 'USER_CREATE', page);
  }
  choosePerson(id: string) {
    const person = this.store.people()?.items.find((p) => p.id === id);
    if (person) {
      this.form.controls.personId.setValue(person.id);
      this.form.markAsDirty();
      this.selectedPerson.set(person);
    }
  }
  unlink() {
    this.form.controls.personId.setValue('');
    this.form.markAsDirty();
    this.selectedPerson.set(null);
  }
  canManageSecurity(user: UserAccount) {
    return (
      this.allowed('USER_CHANGE_STATUS', user) ||
      (this.allowed('USER_CREATE', user) &&
        user.isActive &&
        !user.hasPassword &&
        !user.emailConfirmed)
    );
  }
  async edit(mode: 'profile' | 'grants' | 'security') {
    const user = this.store.detail();
    if (
      !user ||
      !(mode === 'security'
        ? this.canManageSecurity(user)
        : this.allowed(mode === 'profile' ? 'USER_UPDATE' : 'USER_ASSIGN_ROLE', user)) ||
      (mode === 'grants' && this.protectedAccount(user))
    )
      return;
    if (this.editing() === mode) return;
    if (!(await this.canLeave())) return;
    this.restore(user);
    this.editing.set(mode);
    if (mode === 'grants') this.store.loadOptions('USER_ASSIGN_ROLE');
  }
  private async confirm(header: string, message: string) {
    if (this.confirming() || this.store.busy()) return false;
    this.confirming.set(true);
    const result = await new Promise<boolean>((resolve) => {
      this.finishConfirmation = resolve;
      this.confirmation.confirm({
        header,
        message,
        acceptLabel: 'Confirmar',
        rejectLabel: 'Cancelar',
        closeOnEscape: false,
        accept: () => resolve(true),
        reject: () => resolve(false),
      });
    });
    this.finishConfirmation = undefined;
    this.confirming.set(false);
    return result && this.auth.authenticated();
  }
  async save() {
    if (this.editing() === 'security') return;
    this.form.markAllAsTouched();
    if (this.store.busy() || this.confirming()) return;
    const raw = this.form.getRawValue();
    if (!raw.displayName.trim() || this.form.controls.displayName.invalid) return;
    const user = this.store.detail();
    if (this.id && this.editing() === 'profile') {
      if (!user || !this.allowed('USER_UPDATE', user)) return;
      if (
        await this.confirm(
          '¿Actualizar la cuenta?',
          'Los cambios de persona vinculada revocarán las sesiones existentes.',
        )
      )
        if (await this.store.update(this.id, raw.displayName, raw.personId || null, false)) {
          this.form.markAsPristine();
          this.completed.next();
        }
      return;
    }
    if (
      this.form.invalid ||
      !this.store.options() ||
      raw.grants.some((g) => this.role(g.roleId) !== 'SUPER_ADMIN' && !g.branchId)
    )
      return;
    const grants = raw.grants.map((g) => ({
      roleId: g.roleId,
      branchId: this.role(g.roleId) === 'SUPER_ADMIN' ? null : g.branchId,
      permissionIds: this.role(g.roleId) === 'OPERATOR' ? g.permissionIds : [],
    }));
    if (this.id) {
      if (!user || !this.allowed('USER_ASSIGN_ROLE', user) || this.protectedAccount(user)) return;
      if (
        await this.confirm(
          '¿Sustituir los accesos?',
          'Se reemplazarán todas las concesiones y se revocarán las sesiones anteriores.',
        )
      )
        if (await this.store.grants(this.id, grants, false)) {
          this.form.markAsPristine();
          this.completed.next();
        }
    } else if (
      this.allowed('USER_CREATE') &&
      (await this.confirm(
        '¿Crear la cuenta e invitar?',
        'El destinatario establecerá su propia contraseña mediante una invitación con vigencia limitada.',
      ))
    ) {
      if (
        await this.store.invite({
          email: raw.email.trim(),
          displayName: raw.displayName.trim(),
          personId: raw.personId || null,
          grants,
        })
      ) {
        this.form.markAsPristine();
        this.completed.next();
      }
    }
  }
  async action(kind: 'resend' | 'active' | 'revoke') {
    const user = this.store.detail();
    if (!user) return;
    const permission = kind === 'resend' ? 'USER_CREATE' : 'USER_CHANGE_STATUS';
    if (!this.allowed(permission, user) || (kind === 'active' && this.protectedAccount(user)))
      return;
    if (this.form.dirty) {
      if (!(await this.canLeave())) return;
      this.restore(user);
    }
    if (
      !(await this.confirm(
        kind === 'resend'
          ? '¿Reenviar la invitación?'
          : kind === 'revoke'
            ? '¿Cerrar las sesiones y anular los enlaces?'
            : user.isActive
              ? '¿Desactivar la cuenta?'
              : '¿Reactivar la cuenta?',
        kind === 'resend'
          ? 'El enlace anterior dejará de ser válido. La aceptación del envío no garantiza entrega.'
          : 'Se invalidarán las sesiones y los enlaces de invitación anteriores. No se elimina la cuenta ni se cambia su contraseña. Si la cuenta sigue activa y ya tiene contraseña, podrá iniciar sesión de nuevo.',
      ))
    )
      return;
    if (kind === 'resend') await this.store.resend(user.id);
    else if (kind === 'revoke') await this.store.revoke(user.id);
    else await this.store.active(user.id, !user.isActive);
  }
  async cancelEdit() {
    if (await this.canLeave()) {
      this.editing.set(null);
      this.form.markAsPristine();
      if (this.id) this.store.loadDetail(this.id);
    }
  }
  canLeave(): boolean | Promise<boolean> {
    if (!this.auth.authenticated() || this.store.created()) return true;
    if (this.store.busy() || this.confirming()) return false;
    if (!this.form.dirty) return true;
    return this.confirm('¿Descartar los cambios?', 'Hay cambios de cuenta sin guardar.');
  }
}
