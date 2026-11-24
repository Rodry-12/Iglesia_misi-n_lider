import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { UsersStore } from './users.store';
import { UserAccountEditor } from './user-account-editor';
import { UserAccountForm } from './user-account-form';
import { UserDialogBase } from './user-dialog-base';

@Component({
  selector: 'app-user-invite-dialog',
  imports: [DialogModule, ButtonModule, ConfirmDialogModule, UserAccountForm],
  providers: [UsersStore, UserAccountEditor, ConfirmationService],
  template: `<p-dialog
      header="Invitar usuario"
      [visible]="editor.ready()"
      [modal]="true"
      [closable]="false"
      [closeOnEscape]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '44rem', maxWidth: 'calc(100vw - 2rem)' }"
      (keydown.escape)="close()"
    >
      <p class="user-hint">
        La persona invitada establecerá su propia contraseña al activar la cuenta.
      </p>
      <app-user-account-form formId="user-account-invite-form" [showSubmit]="false" />
      <ng-template #footer>
        <div class="user-dialog-actions">
          <button
            pButton
            type="button"
            [outlined]="true"
            [disabled]="editor.store.busy() || editor.confirming()"
            (click)="close()"
          >
            Cancelar
          </button>
          <button
            pButton
            type="submit"
            form="user-account-invite-form"
            [loading]="editor.store.busy()"
            [disabled]="editor.store.busy() || editor.confirming() || !editor.store.options()"
          >
            Crear e invitar
          </button>
        </div>
      </ng-template> </p-dialog
    ><p-confirmdialog />`,
  styleUrl: './user-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserInviteDialog extends UserDialogBase {
  constructor() {
    super();
    this.editor.initialize(null, 'invite');
  }
}
