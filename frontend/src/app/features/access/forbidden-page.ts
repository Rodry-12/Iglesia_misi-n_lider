import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PageHeading } from '../../shared/ui/page-heading';

@Component({
  selector: 'app-forbidden-page',
  imports: [RouterLink, ButtonModule, PageHeading],
  template: `
    <section class="mx-auto max-w-3xl px-4 py-12">
      <app-page-heading
        title="No tienes acceso a esta sección"
        description="Solicita al responsable de tu sede los permisos que necesitas."
      />
      <a pButton routerLink="/gestion">Volver a gestión</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {}
