import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ProgressSpinner } from 'primeng/progressspinner';
import { HttpActivity } from '../../core/loading/http-activity';

@Component({
  selector: 'app-loading-overlay',
  imports: [ProgressSpinner],
  template: `
    <div
      class="loading-region"
      [class.blocking]="blocking()"
      [class.viewport]="fullscreen()"
      [attr.aria-busy]="blocking() ? busy() : null"
    >
      <div #content [attr.inert]="blocking() && busy() ? '' : null"><ng-content /></div>
      @if (visible() && (blocking() || !activity.regionBlocked())) {
        <div
          class="loading-indicator"
          [class.floating]="!blocking()"
          [class.fullscreen]="fullscreen()"
          role="status"
          [attr.aria-live]="blocking() ? 'polite' : 'off'"
          aria-atomic="true"
        >
          <p-progressspinner
            aria-hidden="true"
            strokeWidth="4"
            animationDuration="1s"
            [pt]="spinnerParts"
          />
          <span>{{ label() }}</span>
        </div>
      }
    </div>
  `,
  styleUrl: './loading-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlay {
  readonly activity = inject(HttpActivity);
  readonly active = input<boolean | undefined>();
  readonly blocking = input(false);
  readonly fullscreen = input(false);
  readonly label = input('Cargando información…');
  readonly busy = computed(() => this.active() ?? this.activity.busy());
  readonly visible = signal(false);
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  readonly spinnerParts = {
    circle: {
      style: {
        animation: 'none',
        stroke: 'var(--ml-color-primary)',
        strokeDasharray: '90, 150',
        strokeDashoffset: '0',
        strokeLinecap: 'round',
      },
    },
  };

  constructor() {
    effect((onCleanup) => {
      if (!this.busy()) {
        this.visible.set(false);
        return;
      }
      const timer = setTimeout(() => this.visible.set(true), 150);
      onCleanup(() => {
        clearTimeout(timer);
        this.visible.set(false);
      });
    });
    effect((onCleanup) => {
      if (!this.blocking() || !this.busy()) return;
      const finish = this.activity.beginBlockingRegion();
      const previousOverflow = this.document.body.style.overflow;
      if (this.fullscreen()) this.document.body.style.overflow = 'hidden';
      const focused = this.document.activeElement as HTMLElement | null;
      const restore = !!focused && !!this.content()?.nativeElement.contains(focused);
      onCleanup(() => {
        finish();
        if (this.fullscreen()) this.document.body.style.overflow = previousOverflow;
        if (restore && !this.destroyRef.destroyed)
          afterNextRender(
            () => {
              if (focused?.isConnected && this.document.activeElement === this.document.body)
                focused.focus();
            },
            { injector: this.injector },
          );
      });
    });
  }
}
