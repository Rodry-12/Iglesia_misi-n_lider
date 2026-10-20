import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
    >
      @if (theme.isDark()) {
        <svg lucideSun aria-hidden="true" [size]="18"></svg>
      } @else {
        <svg lucideMoon aria-hidden="true" [size]="18"></svg>
      }
      {{ theme.isDark() ? 'Tema claro' : 'Tema oscuro' }}
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggle {
  readonly theme = inject(ThemeState);
}
