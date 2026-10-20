import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  ElementRef,
  inject,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { PUBLIC_NAVIGATION, PUBLIC_SIGN_IN } from '../../../../core/navigation/public-navigation';
import { SiteBrand } from '../site-brand/site-brand';
import { DOCUMENT } from '@angular/common';
import { CHURCH_CONTENT } from '../../../../core/content/church-content';

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, SiteBrand],
  templateUrl: './site-header.html',
  styleUrl: './site-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeader {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  readonly church = CHURCH_CONTENT;
  readonly scrolled = signal(false);
  readonly isHome = signal(this.router.url.split(/[?#]/)[0] === '/');
  readonly navigation = PUBLIC_NAVIGATION.filter((item) => item.label !== 'Contacto');
  readonly signIn = PUBLIC_SIGN_IN;
  readonly menuOpen = signal(false);
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');

  constructor() {
    afterNextRender(() => this.onScroll());
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.closeMenu();
        this.isHome.set(this.router.url.split(/[?#]/)[0] === '/');
        this.onScroll();
      });
  }

  @HostListener('window:scroll') onScroll(): void {
    this.scrolled.set((this.document.defaultView?.scrollY ?? 0) > 80);
  }

  closeMenu(restoreFocus = false): void {
    this.menuOpen.set(false);
    if (restoreFocus) this.menuButton()?.nativeElement.focus();
  }
}
