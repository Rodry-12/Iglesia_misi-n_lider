import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { PaginatorState } from 'primeng/paginator';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

export const TABLE_PAGE_SIZES = [10, 20, 50];
export function tablePageSize(value: unknown): number {
  const size = Number(value);
  return TABLE_PAGE_SIZES.includes(size) ? size : 10;
}

@Component({
  selector: 'app-table-pagination',
  imports: [FormsModule, ButtonModule, SelectModule, LucideChevronLeft, LucideChevronRight],
  template: `
    <p role="status" aria-live="polite">
      Mostrando {{ start() }}–{{ end() }} de {{ totalRecords() }} {{ noun() }}
    </p>
    <div class="controls">
      <span>Por página</span>
      <p-select
        ariaLabel="Registros por página"
        [options]="sizes"
        [ngModel]="rows()"
        (ngModelChange)="change(1, $event)"
        [disabled]="disabled()"
        appendTo="body"
      />
      <nav [attr.aria-label]="ariaLabel()">
        <button
          pButton
          type="button"
          [outlined]="true"
          aria-label="Anterior"
          title="Página anterior"
          [disabled]="disabled() || page() <= 1"
          (click)="change(page() - 1)"
        >
          <svg lucideChevronLeft [size]="18" aria-hidden="true"></svg>
        </button>
        <span class="current" aria-current="page"
          ><span class="sr-only">Página </span>{{ page() }}</span
        >
        <button
          pButton
          type="button"
          [outlined]="true"
          aria-label="Siguiente"
          title="Página siguiente"
          [disabled]="disabled() || page() * rows() >= totalRecords()"
          (click)="change(page() + 1)"
        >
          <svg lucideChevronRight [size]="18" aria-hidden="true"></svg>
        </button>
      </nav>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: var(--ml-space-4);
      padding: var(--ml-space-4);
    }
    p {
      margin: 0;
      color: var(--ml-color-muted);
    }
    .controls,
    nav {
      display: flex;
      align-items: center;
      gap: var(--ml-space-2);
    }
    .controls {
      flex-wrap: wrap;
      justify-content: flex-end;
      max-width: 100%;
    }
    button,
    .current {
      min-width: var(--ml-touch-target);
      min-height: var(--ml-touch-target);
    }
    .current {
      display: grid;
      place-items: center;
      background: var(--ml-color-primary);
      color: var(--ml-color-on-primary);
      border-radius: var(--ml-radius-control);
      font-weight: 600;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablePagination {
  readonly first = input(0);
  readonly rows = input(10);
  readonly totalRecords = input(0);
  readonly noun = input('registros');
  readonly ariaLabel = input('Páginas de resultados');
  readonly disabled = input(false);
  readonly onPageChange = output<PaginatorState>();
  readonly sizes = TABLE_PAGE_SIZES;
  readonly page = computed(() => Math.floor(this.first() / this.rows()) + 1);
  readonly start = computed(() => (this.totalRecords() ? this.first() + 1 : 0));
  readonly end = computed(() => Math.min(this.first() + this.rows(), this.totalRecords()));
  change(page: number, size = this.rows()) {
    if (this.disabled() || !TABLE_PAGE_SIZES.includes(size) || page < 1) return;
    this.onPageChange.emit({ first: (page - 1) * size, rows: size, page: page - 1 });
  }
}
