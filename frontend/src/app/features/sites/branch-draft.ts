import { computed, Directive, HostListener, inject, output, signal } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { AuthStore } from '../../core/auth/auth.store';
import { BranchesStore } from './branches.store';
import { createBranchForm } from './branch-form-fields';

/** Shared form policy only; create/edit keep separate components and stores. */
@Directive()
export abstract class BranchDraft {
  readonly store = inject(BranchesStore);
  protected readonly auth = inject(AuthStore);
  private readonly confirmation = inject(ConfirmationService);
  readonly form = createBranchForm();
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly closing = signal(false);
  readonly global = computed(
    () =>
      this.auth
        .session()
        ?.grants.some((g) => g.roleCode === 'SUPER_ADMIN' && g.branchId === null) ?? false,
  );
  private leaving?: Promise<boolean>;
  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent) {
    if (this.form.dirty || this.store.busy()) event.preventDefault();
  }
  canLeave(): boolean | Promise<boolean> {
    if (this.store.busy()) return false;
    if (!this.form.dirty) return true;
    return (this.leaving ??= new Promise<boolean>((resolve) =>
      this.confirmation.confirm({
        header: 'Descartar cambios',
        message: 'Tienes cambios sin guardar. ¿Deseas descartarlos?',
        acceptLabel: 'Descartar cambios',
        rejectLabel: 'Seguir editando',
        defaultFocus: 'reject',
        accept: () => {
          this.form.markAsPristine();
          this.leaving = undefined;
          resolve(true);
        },
        reject: () => {
          this.leaving = undefined;
          resolve(false);
        },
      }),
    ));
  }
  async requestClose() {
    if (this.closing()) return;
    this.closing.set(true);
    if (await this.canLeave()) this.closed.emit();
    this.closing.set(false);
  }
  protected body() {
    this.form.markAllAsTouched();
    if (!this.global() || this.form.invalid || this.store.busy()) return null;
    const value = this.form.getRawValue();
    return {
      code: value.code.trim(),
      name: value.name.trim(),
      address: value.address.trim() || null,
      phone: value.phone.trim() || null,
    };
  }
  protected complete() {
    this.form.markAsPristine();
    this.saved.emit();
  }
}
