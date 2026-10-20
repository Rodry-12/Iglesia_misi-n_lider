import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeState {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<'light' | 'dark'>('light');
  readonly mode = this.current.asReadonly();
  readonly isDark = computed(() => this.mode() === 'dark');

  constructor() {
    effect(() => {
      this.document.documentElement.dataset['theme'] = this.mode();
    });
  }

  toggle(): void {
    this.current.update((mode) => (mode === 'light' ? 'dark' : 'light'));
  }
}
