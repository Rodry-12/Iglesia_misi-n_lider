import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ToastFeedback } from '../../shared/ui/toast-feedback';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { AccessContext } from '../../core/auth/access-context';
import { CatalogStore } from './catalog.store';
import { CatalogError, CatalogItem, CatalogKind, catalogPermission } from './catalog.models';
import { LucidePower } from '@lucide/angular';

@Component({
  selector: 'app-catalog-error',
  imports: [ToastFeedback],
  template: `
    @if (error(); as error) {
      <app-toast-feedback
        severity="error"
        [message]="
          error === 'conflict'
            ? 'No fue posible guardar: el nombre ya existe o la operación no cumple las reglas del catálogo. Revisa los datos actuales.'
            : error === 'invalid'
              ? 'Revisa los campos: la API no aceptó la información.'
              : error === 'forbidden'
                ? 'No tienes permiso para esta operación.'
                : error === 'not-found'
                  ? 'El registro o la categoría habilitada no está disponible.'
                  : error === 'unconfirmed'
                    ? 'No se pudo confirmar la operación. Consulta los datos actuales antes de volver a intentarlo.'
                    : 'No fue posible consultar la información. Inténtalo nuevamente.'
        "
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogErrorMessage {
  readonly error = input<CatalogError>(null);
}

@Component({
  selector: 'app-catalog-state',
  imports: [ButtonModule, ConfirmDialogModule, LucidePower],
  providers: [ConfirmationService],
  template: `
    @if (allowed()) {
      <button
        pButton
        type="button"
        [text]="true"
        [disabled]="store.busy()"
        [attr.aria-label]="label() + ' ' + item().name"
        [title]="label()"
        (click)="change()"
      >
        <svg lucidePower [size]="18" aria-hidden="true"></svg>
      </button>
      <p-confirmdialog
        [closable]="false"
        [style]="{ width: '32rem', maxWidth: 'calc(100vw - var(--ml-space-8))' }"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogStateAction {
  readonly kind = input.required<CatalogKind>();
  readonly item = input.required<CatalogItem>();
  readonly store = inject(CatalogStore);
  private readonly access = inject(AccessContext);
  private readonly confirmation = inject(ConfirmationService);
  private confirming = false;
  readonly allowed = computed(() =>
    this.access.can(catalogPermission(this.kind(), 'UPDATE'), null),
  );
  readonly label = computed(
    () =>
      `${this.item().isActive ? 'Desactivar' : 'Activar'} ${this.kind() === 'category' ? 'categoría' : 'proceso'}`,
  );
  change(): void {
    if (!this.allowed() || this.store.busy() || this.confirming) return;
    const item = this.item();
    const kind = this.kind();
    const apply = () => {
      this.confirming = false;
      if (
        this.allowed() &&
        !this.store.busy() &&
        item.id === this.item().id &&
        item.isActive === this.item().isActive
      )
        void this.store.setActive(kind, item.id, !item.isActive);
    };
    if (!item.isActive) {
      apply();
      return;
    }
    this.confirming = true;
    this.confirmation.confirm({
      header: '¿Desactivar elemento del catálogo?',
      message:
        'Se conservarán los registros y las asignaciones existentes. El elemento no estará disponible para nuevas asignaciones. Desactivar una categoría afecta la disponibilidad de sus procesos sin cambiar sus estados individuales.',
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
