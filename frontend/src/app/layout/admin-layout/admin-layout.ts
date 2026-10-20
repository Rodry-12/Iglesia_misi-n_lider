import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { LucidePanelLeft, LucideShieldCheck } from '@lucide/angular';
import { AccessContext } from '../../core/auth/access-context';
import { ADMIN_NAVIGATION } from '../../core/navigation/admin-navigation';
import { ThemeToggle } from '../../shared/ui/theme-toggle';

@Component({
  selector: 'app-admin-layout',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ButtonModule,
    ThemeToggle,
    LucidePanelLeft,
    LucideShieldCheck,
  ],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  readonly access = inject(AccessContext);
  readonly menuOpen = signal(false);
  readonly navigation = computed(() =>
    ADMIN_NAVIGATION.filter((item) => this.access.can(item.permission)),
  );
}
