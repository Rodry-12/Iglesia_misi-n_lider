import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-page-heading',
  template: `
    <div class="mb-6">
      <p class="text-sm font-semibold tracking-wide text-brand">{{ eyebrow() }}</p>
      <h1 class="mt-2 text-3xl font-bold text-content">{{ title() }}</h1>
      <p class="max-w-3xl text-muted">{{ description() }}</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeading {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly eyebrow = input('Misión Líder París');
}
