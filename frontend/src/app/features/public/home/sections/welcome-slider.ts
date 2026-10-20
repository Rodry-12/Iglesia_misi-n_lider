import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { PUBLIC_REFERENCE } from '../../../../core/content/public-reference-content';
import { GalleriaModule } from 'primeng/galleria';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-welcome-slider',
  imports: [GalleriaModule, ButtonModule],
  templateUrl: './welcome-slider.html',
  styleUrl: './welcome-slider.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeSlider {
  readonly slides = PUBLIC_REFERENCE.slides.map((slide) => ({ ...slide }));
  readonly current = signal(0);
  readonly paused = signal(false);
  readonly hovered = signal(false);
  readonly focused = signal(false);
  readonly reducedMotion = signal(true);
  private readonly document = inject(DOCUMENT);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroy = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const media = this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (!media) return;
      this.reducedMotion.set(media.matches);
      const update = () => this.reducedMotion.set(media.matches);
      media.addEventListener('change', update);
      this.destroy.onDestroy(() => media.removeEventListener('change', update));
    });
    // Galleria renders/navigates; this effect coordinates accessible autoplay
    // through activeIndex without calling internal library slideshow methods.
    effect((cleanup) => {
      if (this.paused() || this.hovered() || this.focused() || this.reducedMotion()) return;
      const timer = setInterval(
        () => this.current.update((value) => (value + 1) % this.slides.length),
        3000,
      );
      cleanup(() => clearInterval(timer));
    });
  }

  select(index: number): void {
    this.paused.set(true);
    this.current.set((index + this.slides.length) % this.slides.length);
  }
  next(): void {
    this.select(this.current() + 1);
  }
  previous(): void {
    this.select(this.current() - 1);
  }
  focusOut(event: FocusEvent): void {
    this.focused.set(this.element.nativeElement.contains(event.relatedTarget as Node | null));
  }
}
