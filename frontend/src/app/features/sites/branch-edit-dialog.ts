import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { BranchesStore } from './branches.store';
import { BranchFormFields } from './branch-form-fields';
import { BranchDraft } from './branch-draft';

@Component({
  selector: 'app-branch-edit-dialog',
  imports: [
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    ToastFeedback,
    ConfirmDialogModule,
    BranchFormFields,
  ],
  providers: [BranchesStore, ConfirmationService],
  template: `
    <p-dialog
      header="Editar sede"
      [visible]="!!store.detail() && !store.loading().detail"
      [modal]="true"
      [closable]="false"
      [closeOnEscape]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '38rem', maxWidth: 'calc(100vw - 2rem)' }"
      (keydown.escape)="requestClose()"
    >
      <p class="dialog-intro">Actualiza la información de la sede. Se conservarán sus vínculos.</p>
      @if (store.errors().detail; as error) {
        <app-toast-feedback severity="error" [message]="error" />
        <button pButton type="button" (click)="reload()">Reintentar</button>
      }
      @if (store.detail()) {
        <form id="branch-edit-form" (ngSubmit)="save()" [formGroup]="form" novalidate>
          <app-branch-form-fields [form]="form" [busy]="store.busy()" />
          @if (store.errors().command; as error) {
            <app-toast-feedback severity="error" [message]="error" />
            <button
              pButton
              type="button"
              [text]="true"
              [disabled]="store.busy()"
              (click)="reload()"
            >
              Recargar datos de la sede
            </button>
          }
        </form>
        @if (global()) {
          @if (store.detail(); as branch) {
            <section class="branch-state-editor" aria-label="Estado operativo">
              <div>
                <strong>Estado operativo</strong>
                <p>{{ branch.isActive ? 'Sede activa' : 'Sede inactiva' }}</p>
              </div>
              <button
                pButton
                type="button"
                [outlined]="true"
                [disabled]="store.busy() || confirming()"
                (click)="changeState()"
              >
                {{ branch.isActive ? 'Desactivar sede' : 'Reactivar sede' }}
              </button>
            </section>
          }
        }
      }
      <ng-template #footer>
        <button
          pButton
          type="button"
          [outlined]="true"
          [disabled]="store.busy() || closing()"
          (click)="requestClose()"
        >
          Cancelar
        </button>
        <button
          pButton
          type="submit"
          form="branch-edit-form"
          [loading]="store.busy()"
          [disabled]="store.busy() || !global() || !store.detail()"
        >
          Guardar cambios
        </button>
      </ng-template>
    </p-dialog>
    <p-confirmdialog />
  `,
  styleUrl: './branch-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchEditDialog extends BranchDraft {
  readonly branchId = input.required<string>();
  private readonly stateConfirmation = inject(ConfirmationService);
  readonly confirming = signal(false);
  constructor() {
    super();
    effect(() => {
      this.form.reset();
      this.store.loadDetail(this.branchId());
    });
    effect(() => {
      if (this.store.errors().detail && !this.store.loading().detail) this.closed.emit();
    });
    effect(() => {
      const value = this.store.detail();
      if (value) {
        this.form.reset({
          code: value.code,
          name: value.name,
          address: value.address ?? '',
          phone: value.phone ?? '',
        });
      }
    });
  }
  async reload() {
    if (await this.canLeave()) this.store.loadDetail(this.branchId());
  }
  async save() {
    const body = this.body(),
      branch = this.store.detail();
    if (
      body &&
      branch &&
      (await this.store.save(branch.id, { ...body, expectedUpdatedAt: branch.updatedAt }))
    )
      this.complete();
  }
  async changeState() {
    const branch = this.store.detail();
    if (!branch || !this.global() || this.store.busy() || this.confirming()) return;
    if (!(await this.canLeave())) return;
    this.confirming.set(true);
    const identity = JSON.stringify(this.auth.session());
    this.stateConfirmation.confirm({
      header: branch.isActive ? 'Desactivar sede' : 'Reactivar sede',
      message: branch.isActive
        ? 'Se comprobarán personas, procesos y concesiones. No se eliminarán registros ni se modificarán usuarios. ¿Continuar?'
        : '¿Deseas reactivar esta sede?',
      acceptLabel: 'Confirmar',
      rejectLabel: 'Cancelar',
      defaultFocus: 'reject',
      accept: async () => {
        this.confirming.set(false);
        if (
          identity === JSON.stringify(this.auth.session()) &&
          (await this.store.setActive(branch))
        )
          this.complete();
      },
      reject: () => this.confirming.set(false),
    });
  }
}
