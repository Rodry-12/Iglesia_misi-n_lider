import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { AuthStore } from '../../core/auth/auth.store';
import { BranchesStore } from './branches.store';

@Component({
  selector: 'app-branch-detail-dialog',
  imports: [DialogModule, ButtonModule, ToastFeedback],
  providers: [BranchesStore],
  template: `
    <p-dialog
      header="Detalle de sede"
      [visible]="opened()"
      [modal]="true"
      [closable]="false"
      [closeOnEscape]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '42rem', maxWidth: 'calc(100vw - 2rem)' }"
      (keydown.escape)="closed.emit()"
    >
      @if (store.detail(); as branch) {
        <h2 class="branch-detail-name">{{ branch.name }}</h2>
        <dl class="branch-facts">
          <div>
            <dt>Código</dt>
            <dd>{{ branch.code }}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <span class="detail-status" [class.active]="branch.isActive">{{
                branch.isActive ? 'Activa' : 'Inactiva'
              }}</span>
            </dd>
          </div>
          <div>
            <dt>Dirección</dt>
            <dd>{{ branch.address || 'Sin registrar' }}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>{{ branch.phone || 'Sin registrar' }}</dd>
          </div>
        </dl>
        @if (global()) {
          <section class="administrators" aria-label="Administradores asociados">
            <div class="administrators-heading">
              <h3>Administradores asociados</h3>
              @if (store.administrators(); as result) {
                <span class="administrator-count">{{ result.totalCount }}</span>
              }
            </div>
            @if (store.administrators(); as result) {
              <ul class="administrator-list">
                @for (user of result.items; track user.userId) {
                  <li class="administrator">
                    <span class="administrator-avatar" aria-hidden="true">{{
                      user.displayName.trim().slice(0, 1).toUpperCase()
                    }}</span>
                    <div class="administrator-info">
                      <strong>{{ user.displayName }}</strong
                      ><span>{{ user.email }}</span>
                    </div>
                    <span class="detail-status" [class.active]="user.isActive">{{
                      user.isActive ? 'Habilitada' : 'Desactivada'
                    }}</span>
                  </li>
                } @empty {
                  <li class="administrators-empty">Sin administradores asociados.</li>
                }
              </ul>
              @if (result.items.length < result.totalCount && !store.errors().administrators) {
                <button
                  pButton
                  type="button"
                  [text]="true"
                  [disabled]="store.loading().administrators"
                  (click)="more()"
                >
                  Ver más administradores
                </button>
              }
            }
            @if (store.errors().administrators; as error) {
              <app-toast-feedback severity="error" [message]="error" />
              <button pButton type="button" [text]="true" (click)="more()">Reintentar</button>
            }
          </section>
        }
      }
      <ng-template #footer
        ><button pButton type="button" (click)="closed.emit()">Cerrar</button></ng-template
      >
    </p-dialog>
  `,
  styleUrl: './branch-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchDetailDialog {
  readonly store = inject(BranchesStore);
  private readonly auth = inject(AuthStore);
  readonly branchId = input.required<string>();
  readonly closed = output<void>();
  readonly opened = signal(false);
  readonly global = computed(
    () =>
      this.auth
        .session()
        ?.grants.some((g) => g.roleCode === 'SUPER_ADMIN' && g.branchId === null) ?? false,
  );
  constructor() {
    effect(() => {
      this.opened.set(false);
      this.store.loadDetail(this.branchId());
      if (this.global()) this.store.loadAdministrators(this.branchId());
    });
    effect(() => {
      if (this.store.errors().detail && !this.store.loading().detail) {
        this.closed.emit();
        return;
      }
      if (
        this.store.detail() &&
        !this.store.loading().detail &&
        (!this.global() || !this.store.loading().administrators)
      )
        this.opened.set(true);
    });
  }
  more() {
    if (!this.global() || this.store.loading().administrators) return;
    const result = this.store.administrators();
    this.store.loadAdministrators(this.branchId(), result ? result.pageNumber + 1 : 1, !!result);
  }
}
