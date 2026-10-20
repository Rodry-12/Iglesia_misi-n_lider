import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';
import { PUBLIC_REFERENCE } from '../../../../core/content/public-reference-content';

@Component({
  selector: 'app-ministries-section',
  templateUrl: './ministries-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesSection {
  readonly ministries = PUBLIC_REFERENCE.ministries;
  readonly current = signal(0);
  private readonly rail = viewChild<ElementRef<HTMLElement>>('rail');
  move(direction: number): void {
    const rail = this.rail()?.nativeElement;
    rail?.scrollBy({ left: direction * rail.clientWidth, behavior: this.behavior(rail) });
  }
  select(index: number): void {
    const rail = this.rail()?.nativeElement;
    const card = rail?.children.item(index) as HTMLElement | null;
    if (rail && card) rail.scrollTo({ left: card.offsetLeft, behavior: this.behavior(rail) });
  }
  updatePosition(): void {
    const rail = this.rail()?.nativeElement;
    const card = rail?.firstElementChild as HTMLElement | null;
    if (rail && card) this.current.set(Math.round(rail.scrollLeft / (card.offsetWidth + 6)));
  }
  private behavior(rail: HTMLElement): ScrollBehavior {
    return rail.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
  }
}
