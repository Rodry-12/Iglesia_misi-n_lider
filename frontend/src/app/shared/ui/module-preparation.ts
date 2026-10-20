import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PageHeading } from './page-heading';

@Component({
  selector: 'app-module-preparation',
  imports: [PageHeading],
  template: `
    <app-page-heading [title]="title()" [description]="description()" />
    <div class="rounded-panel border border-outline bg-panel p-6">
      <p class="mb-2 font-semibold text-brand">Próximamente</p>
      <p class="text-muted">Este módulo aún no tiene operaciones habilitadas.</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModulePreparation {
  readonly title = input.required<string>();
  readonly description = input.required<string>();
}
