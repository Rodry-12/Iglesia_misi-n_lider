import { ChangeDetectionStrategy, Component } from '@angular/core';
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
  selector: 'app-branch-create-dialog',
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
      header="Crear sede"
      [visible]="true"
      [modal]="true"
      [closable]="false"
      [closeOnEscape]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '38rem', maxWidth: 'calc(100vw - 2rem)' }"
      (keydown.escape)="requestClose()"
    >
      <p class="dialog-intro">
        Registra la información de la nueva sede. Los campos con * son obligatorios.
      </p>
      <form id="branch-create-form" (ngSubmit)="save()" [formGroup]="form" novalidate>
        <app-branch-form-fields [form]="form" [busy]="store.busy()" />
        @if (store.errors().command; as error) {
          <app-toast-feedback severity="error" [message]="error" />
        }
      </form>
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
          form="branch-create-form"
          [loading]="store.busy()"
          [disabled]="store.busy() || !global()"
        >
          Crear sede
        </button>
      </ng-template>
    </p-dialog>
    <p-confirmdialog />
  `,
  styleUrl: './branch-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchCreateDialog extends BranchDraft {
  async save() {
    const body = this.body();
    if (body && (await this.store.save(null, body))) this.complete();
  }
}
