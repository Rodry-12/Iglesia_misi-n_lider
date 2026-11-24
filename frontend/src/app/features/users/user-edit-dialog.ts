import { ChangeDetectionStrategy, Component, effect, input } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { UsersStore } from './users.store';
import { UserAccountEditor } from './user-account-editor';
import { UserAccountForm } from './user-account-form';
import { UserDialogBase } from './user-dialog-base';

@Component({
  selector: 'app-user-edit-dialog',
  imports: [DialogModule, ButtonModule, ConfirmDialogModule, UserAccountForm],
  providers: [UsersStore, UserAccountEditor, ConfirmationService],
  template: `<p-dialog
      header="Administrar usuario"
      [visible]="editor.ready()"
      [modal]="true"
      [closable]="false"
      [closeOnEscape]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '44rem', maxWidth: 'calc(100vw - 2rem)' }"
      (keydown.escape)="close()"
    >
      @if (editor.store.detail(); as user) {
        <h2 class="user-name">{{ user.displayName }}</h2>
        <p class="user-hint">
          {{ user.email }} · El correo de acceso no se cambia desde esta operación.
        </p>
        <nav class="user-editor-options" aria-label="Edición de usuario">
          @if (editor.allowed('USER_UPDATE', user)) {
            <button
              pButton
              class="user-section-button"
              [class.is-selected]="editor.editing() === 'profile'"
              [attr.aria-pressed]="editor.editing() === 'profile'"
              type="button"
              [disabled]="editor.store.busy() || editor.confirming()"
              (click)="editor.edit('profile')"
            >
              Datos de cuenta
            </button>
          }
          @if (editor.allowed('USER_ASSIGN_ROLE', user) && !editor.protectedAccount(user)) {
            <button
              pButton
              class="user-section-button"
              [class.is-selected]="editor.editing() === 'grants'"
              [attr.aria-pressed]="editor.editing() === 'grants'"
              type="button"
              [disabled]="editor.store.busy() || editor.confirming()"
              (click)="editor.edit('grants')"
            >
              Accesos y permisos
            </button>
          }
          @if (editor.canManageSecurity(user)) {
            <button
              pButton
              type="button"
              class="user-section-button"
              [class.is-selected]="editor.editing() === 'security'"
              [attr.aria-pressed]="editor.editing() === 'security'"
              [disabled]="editor.store.busy() || editor.confirming()"
              (click)="editor.edit('security')"
            >
              Seguridad
            </button>
          }
        </nav>
        @if (editor.allowed('USER_ASSIGN_ROLE', user) && editor.protectedAccount(user)) {
          <p class="user-protected-note">
            Accesos protegidos: esta operación no permite cambiar los permisos de tu propia cuenta
            ni los de una cuenta SuperAdministrador.
          </p>
        }
        @if (editor.editing() === 'profile' || editor.editing() === 'grants') {
          <app-user-account-form formId="user-account-edit-form" [showSubmit]="false" />
        }
        @if (editor.editing() === 'security') {
          <section class="user-security" aria-label="Seguridad de la cuenta">
            @if (
              editor.allowed('USER_CREATE', user) &&
              user.isActive &&
              !user.hasPassword &&
              !user.emailConfirmed
            ) {
              <article class="user-security-action">
                <h3>Invitación pendiente</h3>
                <p class="user-hint">
                  Envía un nuevo enlace para que esta persona active su cuenta. El enlace anterior
                  dejará de funcionar.
                </p>
                <button
                  pButton
                  type="button"
                  [outlined]="true"
                  [disabled]="editor.store.busy() || editor.confirming()"
                  (click)="editor.action('resend')"
                >
                  Reenviar invitación
                </button>
              </article>
            }
            @if (editor.allowed('USER_CHANGE_STATUS', user)) {
              <article class="user-security-action">
                <h3>Cerrar accesos actuales</h3>
                <p class="user-hint">
                  Cierra las sesiones abiertas en otros dispositivos y anula los enlaces de
                  invitación anteriores. Úsalo si sospechas que alguien más accedió a la cuenta.
                </p>
                <p class="user-hint">
                  No elimina la cuenta ni cambia su contraseña. Si sigue activa y ya tiene
                  contraseña, la persona podrá volver a iniciar sesión.
                </p>
                <button
                  pButton
                  type="button"
                  [outlined]="true"
                  [disabled]="editor.store.busy() || editor.confirming()"
                  (click)="editor.action('revoke')"
                >
                  Cerrar sesiones y anular enlaces
                </button>
              </article>
              @if (!editor.protectedAccount(user)) {
                <article class="user-security-action">
                  <h3>
                    {{
                      user.isActive
                        ? 'Suspender el acceso a la cuenta'
                        : 'Permitir el acceso de nuevo'
                    }}
                  </h3>
                  <p class="user-hint">
                    {{
                      user.isActive
                        ? 'Desactiva la cuenta para impedir nuevos inicios de sesión. Se conserva su información.'
                        : 'Reactiva la cuenta para permitir que la persona vuelva a iniciar sesión.'
                    }}
                  </p>
                  <button
                    pButton
                    type="button"
                    [outlined]="true"
                    [disabled]="editor.store.busy() || editor.confirming()"
                    (click)="editor.action('active')"
                  >
                    {{ user.isActive ? 'Desactivar cuenta' : 'Reactivar cuenta' }}
                  </button>
                </article>
              }
            }
          </section>
        }
      }
      <ng-template #footer>
        <div class="user-dialog-actions">
          <button
            pButton
            type="button"
            [outlined]="true"
            [disabled]="editor.store.busy() || editor.confirming()"
            (click)="close()"
          >
            Cerrar
          </button>
          @if (editor.editing() === 'profile' || editor.editing() === 'grants') {
            <button
              pButton
              type="submit"
              form="user-account-edit-form"
              [loading]="editor.store.busy()"
              [disabled]="editor.store.busy() || editor.confirming() || !editor.store.options()"
            >
              Guardar cambios
            </button>
          }
        </div>
      </ng-template> </p-dialog
    ><p-confirmdialog />`,
  styleUrl: './user-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserEditDialog extends UserDialogBase {
  readonly userId = input.required<string>();
  constructor() {
    super();
    effect(() => this.editor.initialize(this.userId(), 'edit'));
  }
}
