import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { LucideMoon, LucideSun } from '@lucide/angular';
import { ThemeState } from '../../core/theme/theme-state';

@Component({
  selector: 'app-theme-toggle',
  imports: [ButtonModule, LucideMoon, LucideSun],
  template: `
    <button
      pButton
      [text]="true"
      type="button"
      (click)="theme.toggle()"
      [attr.aria-pressed]="theme.isDark()"
      [title]="theme.isDark() ? 'Tema claro' : 'Tema oscuro'"
    >
      @if (theme.isDark()) {
        <svg lucideSun aria-hidden="true" [size]="18"></svg>
      } @else {
        <svg lucideMoon aria-hidden="true" [size]="18"></svg>
      }
      <span [class.sr-only]="compact()">{{ theme.isDark() ? 'Tema claro' : 'Tema oscuro' }}</span>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggle {
  readonly compact = input(false);
  readonly theme = inject(ThemeState);
}
