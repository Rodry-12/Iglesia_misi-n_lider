import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { AssignmentStore } from './assignment.store';
import { AuthStore } from '../../core/auth/auth.store';
import { Notifications } from '../../core/notifications/notifications';

@Component({
  selector: 'app-assignment-detail-dialog',
  imports: [DialogModule, ButtonModule],
  providers: [AssignmentStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./catalog.scss'],
  template: `
    <p-dialog
      header="Detalle del seguimiento"
      [visible]="!!store.detail() && !store.loading().detail"
      [modal]="true"
      [closable]="false"
      [closeOnEscape]="false"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '48rem', maxWidth: 'calc(100vw - 2rem)' }"
      (keydown.escape)="closed.emit()"
    >
      @if (store.detail(); as item) {
        <div class="catalog-detail-heading">
          <h2>{{ item.personName ?? 'Participante no visible' }}</h2>
          <span class="catalog-status">{{ item.stateName ?? item.stateCode }}</span>
        </div>
        <dl class="catalog-detail-grid">
          <div>
            <dt>Documento vigente</dt>
            <dd>
              {{
                item.documentNumber
                  ? item.documentType + ' ' + item.documentNumber
                  : 'Sin documento visible'
              }}
            </dd>
          </div>
          <div>
            <dt>Sede</dt>
            <dd>{{ item.branchName ?? 'Sede no disponible' }}</dd>
          </div>
          <div>
            <dt>Proceso</dt>
            <dd>{{ item.processName ?? 'Proceso no disponible' }}</dd>
          </div>
          <div>
            <dt>Categoría</dt>
            <dd>{{ item.categoryName ?? 'Categoría no disponible' }}</dd>
          </div>
          <div class="catalog-description">
            <dt>Responsable</dt>
            <dd>{{ item.responsibleName ?? 'Responsable no visible' }}</dd>
          </div>
          @if (item.processDescription) {
            <div class="catalog-description">
              <dt>Descripción del proceso</dt>
              <dd class="description">{{ item.processDescription }}</dd>
            </div>
          }
          <div>
            <dt>Fecha de asignación</dt>
            <dd>{{ date(item.assignedAt) }}</dd>
          </div>
          <div>
            <dt>Inicio</dt>
            <dd>{{ item.startedAt ? date(item.startedAt) : 'Sin iniciar' }}</dd>
          </div>
          <div>
            <dt>Finalización</dt>
            <dd>{{ item.finishedAt ? date(item.finishedAt) : 'Sin finalizar' }}</dd>
          </div>
        </dl>
      }
      <ng-template #footer
        ><button pButton type="button" (click)="closed.emit()">Cerrar</button></ng-template
      >
    </p-dialog>
  `,
})
export class AssignmentDetailDialog {
  readonly assignmentId = input.required<string>();
  readonly closed = output<void>();
  readonly store = inject(AssignmentStore);
  private readonly auth = inject(AuthStore);
  private readonly notifications = inject(Notifications);
  constructor() {
    const identity = JSON.stringify(this.auth.session());
    effect(() => {
      if (JSON.stringify(this.auth.session()) !== identity) untracked(() => this.closed.emit());
    });
    effect(() => {
      const id = this.assignmentId();
      untracked(() => this.store.loadDetail(id));
    });
    effect(() => {
      const error = this.store.errors().detail;
      if (error && !this.store.loading().detail)
        untracked(() => {
          this.notifications.error(error);
          this.closed.emit();
        });
    });
  }
  date(value: string): string {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
}
