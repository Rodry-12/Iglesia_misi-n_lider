import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AccessContext } from '../../core/auth/access-context';
import { ADMIN_NAVIGATION } from '../../core/navigation/admin-navigation';
import { PageHeading } from '../../shared/ui/page-heading';
import { AuthStore } from '../../core/auth/auth.store';
import { ManagementIcon } from '../../shared/ui/management-icon';
import { accountRoleLabel } from '../../shared/ui/account-labels';
import { permissionLabel } from '../../shared/ui/permission-labels';

const descriptions: Record<string, string> = {
  '/gestion/miembros': 'Consulta y gestiona las personas de tus sedes autorizadas.',
  '/gestion/formacion': 'Consulta procesos ministeriales, asignaciones y seguimiento.',
  '/gestion/sedes': 'Consulta las sedes y sus datos de administración.',
  '/gestion/usuarios': 'Gestiona las cuentas y los accesos dentro de tu ámbito.',
};
const moduleLabels: Record<string, string> = {
  BRANCH: 'Sedes',
  CATEGORY: 'Categorías',
  PERSON: 'Personas',
  PROCESS: 'Procesos ministeriales',
  USER: 'Usuarios',
  REPORT: 'Reportes',
};

@Component({
  selector: 'app-overview-page',
  imports: [RouterLink, ButtonModule, PageHeading, ManagementIcon],
  templateUrl: './overview-page.html',
  styleUrl: './overview-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPage {
  readonly auth = inject(AuthStore);
  readonly access = inject(AccessContext);
  readonly permissionsOpen = signal(false);
  readonly roleLabel = accountRoleLabel;
  readonly roles = computed(() =>
    [...new Set(this.auth.session()?.grants.map((g) => g.roleCode) ?? [])]
      .map(accountRoleLabel)
      .join(' · '),
  );
  readonly globalAccess = computed(
    () =>
      this.auth
        .session()
        ?.grants.some((g) => g.roleCode === 'SUPER_ADMIN' && g.branchId === null) ?? false,
  );
  readonly branches = computed(() => [
    ...new Set(this.auth.session()?.grants.flatMap((g) => (g.branchId ? [g.branchId] : [])) ?? []),
  ]);
  readonly permissionCount = computed(
    () => new Set(this.auth.session()?.grants.flatMap((g) => g.permissions) ?? []).size,
  );
  readonly grantDetails = computed(() =>
    (this.auth.session()?.grants ?? []).map((grant) => {
      const groups = new Map<string, string[]>();
      for (const permission of [...new Set(grant.permissions)].sort()) {
        const module = permission.split('_')[0];
        const label = moduleLabels[module] ?? 'Otros permisos';
        groups.set(label, [...(groups.get(label) ?? []), permission]);
      }
      return {
        ...grant,
        groups: [...groups].map(([name, permissions]) => ({
          name,
          permissions: permissions.map((code) => ({ code, label: permissionLabel(code) })),
        })),
      };
    }),
  );
  readonly navigation = computed(() =>
    ADMIN_NAVIGATION.filter((item) =>
      (item.permissionsAnyOf ?? [item.permission]).some((permission) =>
        this.access.can(permission),
      ),
    ).map((item) => ({ ...item, description: descriptions[item.path] })),
  );
}
