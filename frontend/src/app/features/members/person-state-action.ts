import { LucideUserCheck, LucideUserX } from '@lucide/angular';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { AccessContext } from '../../core/auth/access-context';
import { Person } from './members.models';
import { MembersStore } from './members.store';

@Component({
  selector: 'app-person-state-action',
  imports: [ButtonModule, ConfirmDialogModule, LucideUserCheck, LucideUserX],
  providers: [ConfirmationService],
  template: `
    @if (allowed()) {
      <button
        pButton
        type="button"
        [text]="true"
        [disabled]="busy()"
        [loading]="store.changingStateId() === person().id"
        [attr.aria-label]="label() + ' a ' + person().firstNames + ' ' + person().lastNames"
        [title]="label()"
        (click)="requestChange()"
      >
        @if (iconOnly()) {
          @if (person().isActive) {
            <svg lucideUserX [size]="20" aria-hidden="true"></svg>
          } @else {
            <svg lucideUserCheck [size]="20" aria-hidden="true"></svg>
          }
        } @else {
          {{ label() }}
        }
      </button>
      <p-confirmdialog
        [closable]="false"
        [style]="{ width: '32rem', maxWidth: 'calc(100vw - var(--ml-space-8))' }"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonStateAction {
  readonly person = input.required<Person>();
  readonly iconOnly = input(false);
  readonly store = inject(MembersStore);
  private readonly access = inject(AccessContext);
  private readonly confirmation = inject(ConfirmationService);
  readonly label = computed(() => (this.person().isActive ? 'Desactivar' : 'Activar'));
  readonly busy = computed(
    () => !!this.store.changingStateId() || this.store.creating() || this.store.updating(),
  );
  readonly allowed = computed(
    () =>
      this.access.can('PERSON_VIEW', this.person().branchId) &&
      this.access.can('PERSON_DEACTIVATE', this.person().branchId),
  );
  private confirming = false;
  constructor() {
    effect(() => {
      if (!this.allowed()) {
        this.confirming = false;
        this.confirmation.close();
      }
    });
  }
  requestChange(): void {
    if (!this.allowed() || this.busy() || this.confirming) return;
    const snapshot = this.person();
    const apply = () => {
      this.confirming = false;
      if (
        !this.allowed() ||
        this.busy() ||
        this.person().id !== snapshot.id ||
        this.person().isActive !== snapshot.isActive
      )
        return;
      void this.store.setActive(snapshot.id, !snapshot.isActive);
    };
    if (!snapshot.isActive) {
      apply();
      return;
    }
    this.confirming = true;
    this.confirmation.confirm({
      header: '¿Desactivar persona?',
      message:
        'La persona conservará sus datos, documento y sede. No podrá recibir nuevas asignaciones ni asumir nuevas responsabilidades y se revocarán sus sesiones de acceso vinculadas. Si tiene procesos abiertos, la operación será rechazada.',
      acceptLabel: 'Confirmar desactivación',
      rejectLabel: 'Cancelar',
      closeOnEscape: false,
      accept: apply,
      reject: () => {
        this.confirming = false;
      },
    });
  }
}

@Component({
  selector: 'app-person-state-feedback',
  imports: [ToastFeedback],
  template: `
    @if (store.stateChanged(); as state) {
      <app-toast-feedback
        severity="success"
        [message]="state === 'active' ? 'Activación confirmada.' : 'Desactivación confirmada.'"
      />
    }
    @if (store.stateError(); as error) {
      <app-toast-feedback
        severity="error"
        [message]="
          error === 'conflict'
            ? 'No se pudo cambiar el estado. Revisa los procesos abiertos como participante o responsable, la identificación vigente, la sede activa y las restricciones de cuentas globales vinculadas. Consulta los datos actuales antes de reintentar.'
            : error === 'forbidden'
              ? 'No tienes permiso para cambiar el estado de esta persona.'
              : error === 'not-found'
                ? 'Persona no encontrada o fuera de tu ámbito autorizado.'
                : error === 'invalid'
                  ? 'La API no aceptó la solicitud de cambio de estado.'
                  : 'No se pudo confirmar el cambio. Consulta el estado actual antes de volver a intentarlo.'
        "
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonStateFeedback {
  readonly store = inject(MembersStore);
}
