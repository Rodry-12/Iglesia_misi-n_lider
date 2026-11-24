import { ChangeDetectionStrategy, Component, effect, input } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService } from 'primeng/api';
import { UsersStore } from './users.store';
import { UserAccountEditor } from './user-account-editor';
import { UserDialogBase } from './user-dialog-base';

@Component({
  selector: 'app-user-view-dialog',
  imports: [DialogModule, ButtonModule],
  providers: [UsersStore, UserAccountEditor, ConfirmationService],
  template: `<p-dialog
    header="Detalle de usuario"
    [visible]="editor.ready()"
    [modal]="true"
    [closable]="false"
    [closeOnEscape]="false"
    [draggable]="false"
    [resizable]="false"
    [style]="{ width: '40rem', maxWidth: 'calc(100vw - 2rem)' }"
    (keydown.escape)="close()"
  >
    @if (editor.store.detail(); as user) {
      <h2 class="user-name">{{ user.displayName }}</h2>
      <dl class="user-facts">
        <div>
          <dt>Correo de acceso</dt>
          <dd>{{ user.email }}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>{{ editor.status(user) }}</dd>
        </div>
        <div>
          <dt>Persona asociada</dt>
          <dd>
            {{
              user.personName ??
                (user.personId ? 'Persona fuera del ámbito visible' : 'Sin persona asociada')
            }}
          </dd>
        </div>
      </dl>
      <h3>Accesos asignados</h3>
      @for (grant of user.grants; track $index) {
        <section class="user-grant">
          <strong>{{ editor.displayRole(grant.roleId) }}</strong
          ><span>{{ editor.branch(grant.branchId) }}</span>
          @if (grant.permissionIds?.length) {
            <ul>
              @for (permission of grant.permissionIds; track permission) {
                <li>{{ editor.permission(permission) }}</li>
              }
            </ul>
          }
        </section>
      }
    }
    <ng-template #footer
      ><button pButton type="button" (click)="close()">Cerrar</button></ng-template
    >
  </p-dialog>`,
  styleUrl: './user-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserViewDialog extends UserDialogBase {
  readonly userId = input.required<string>();
  constructor() {
    super();
    effect(() => this.editor.initialize(this.userId(), 'view'));
  }
}
