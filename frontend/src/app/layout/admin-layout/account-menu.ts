import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { LucideChevronDown } from '@lucide/angular';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-account-menu',
  imports: [ButtonModule, Menu, LucideChevronDown],
  template: `
    <button
      pButton
      [text]="true"
      class="account-trigger"
      type="button"
      aria-label="Menú de cuenta"
      aria-haspopup="menu"
      aria-controls="admin-account-menu"
      [attr.aria-expanded]="open()"
      [disabled]="auth.busy()"
      (click)="menu.toggle($event)"
    >
      <span class="account-avatar" aria-hidden="true">{{ initials() }}</span>
      <span class="account-identity"
        ><strong>{{ displayName() }}</strong
        ><span>{{ roles() || 'Cuenta autorizada' }}</span></span
      >
      <svg lucideChevronDown [size]="16" aria-hidden="true"></svg>
    </button>
    <p-menu
      #menu
      [id]="'admin-account-menu'"
      [model]="items"
      [popup]="true"
      appendTo="body"
      ariaLabel="Opciones de cuenta"
      (onShow)="open.set(true)"
      (onHide)="open.set(false)"
    >
      <ng-template #item let-item
        ><span class="logout-label">{{ item.label }}</span></ng-template
      >
    </p-menu>
  `,
  styleUrl: './account-menu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountMenu {
  readonly auth = inject(AuthStore);
  readonly displayName = input.required<string>();
  readonly roles = input('');
  readonly open = signal(false);
  readonly items: MenuItem[] = [
    {
      label: 'Cerrar sesión',
      command: () => {
        void this.auth.logout();
      },
    },
  ];
  readonly initials = computed(() =>
    this.displayName()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toLocaleUpperCase('es'),
  );
}
