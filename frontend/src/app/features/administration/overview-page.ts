import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AccessContext } from '../../core/auth/access-context';
import { ADMIN_NAVIGATION } from '../../core/navigation/admin-navigation';
import { PageHeading } from '../../shared/ui/page-heading';

@Component({
  selector: 'app-overview-page',
  imports: [RouterLink, ButtonModule, PageHeading],
  template: `
    <app-page-heading
      title="Resumen de gestión"
      description="Accede a las áreas habilitadas para tu cuenta y tus sedes."
    />
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      @for (item of navigation(); track item.path) {
        <article class="rounded-panel border border-outline bg-panel p-6">
          <h2 class="mb-4 text-xl font-semibold">{{ item.title }}</h2>
          <a pButton [text]="true" [routerLink]="item.path">Abrir {{ item.title }}</a>
        </article>
      } @empty {
        <p class="text-muted">
          Todavía no tienes áreas habilitadas. Consulta con el responsable de tu sede.
        </p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPage {
  private readonly access = inject(AccessContext);
  readonly navigation = computed(() =>
    ADMIN_NAVIGATION.filter((item) => this.access.can(item.permission)),
  );
}
