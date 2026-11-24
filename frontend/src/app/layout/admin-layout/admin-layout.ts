import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { LucideChevronDown, LucidePanelLeft, LucideShieldCheck } from '@lucide/angular';
import { AccessContext } from '../../core/auth/access-context';
import { ADMIN_NAVIGATION } from '../../core/navigation/admin-navigation';
import { ThemeToggle } from '../../shared/ui/theme-toggle';
import { AuthStore } from '../../core/auth/auth.store';
import { ManagementIcon } from '../../shared/ui/management-icon';
import { accountRoleLabel } from '../../shared/ui/account-labels';
import { AccountMenu } from './account-menu';
import { Notifications } from '../../core/notifications/notifications';

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
    LucideChevronDown,
    AccountMenu,
    ManagementIcon,
  ],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  readonly auth = inject(AuthStore);
  readonly access = inject(AccessContext);
  private readonly notifications = inject(Notifications);
  private readonly router = inject(Router);
  readonly trainingExpanded = signal(this.router.url.startsWith('/gestion/formacion'));
  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        if (event.urlAfterRedirects.startsWith('/gestion/formacion'))
          this.trainingExpanded.set(true);
      });
    effect(() => {
      const error = this.auth.error();
      if (error) this.notifications.warn(error);
    });
  }
  private readonly document = inject(DOCUMENT);
  readonly menuOpen = signal(
    this.document.defaultView?.matchMedia?.('(min-width: 64rem)')?.matches ?? false,
  );
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  readonly branchLabel = computed(() => {
    const grants = this.auth.session()?.grants ?? [];
    if (grants.some((g) => g.roleCode === 'SUPER_ADMIN' && g.branchId === null))
      return 'Todas las sedes';
    const firstBranch = grants.find((g) => g.branchId);
    return firstBranch ? firstBranch.branchName?.trim() || 'Sede autorizada' : 'Gestión';
  });
  readonly roleLabels = computed(() =>
    [
      ...new Set(
        this.auth.session()?.grants.map((g) => g.roleCode) ?? this.access.principal()?.roles ?? [],
      ),
    ]
      .map(accountRoleLabel)
      .join(' · '),
  );
  closeMenu(restoreFocus = false): void {
    if (restoreFocus || !this.document.defaultView?.matchMedia?.('(min-width: 64rem)')?.matches)
      this.menuOpen.set(false);
    if (restoreFocus) this.menuButton()?.nativeElement.focus();
  }
  readonly navigation = computed(() =>
    ADMIN_NAVIGATION.filter((item) =>
      (item.permissionsAnyOf ?? [item.permission]).some((permission) =>
        this.access.can(permission),
      ),
    ).map((item) => ({
      ...item,
      children: item.children?.filter((child) =>
        this.access.can(child.permission, child.globalPermission ? null : undefined),
      ),
    })),
  );
}
