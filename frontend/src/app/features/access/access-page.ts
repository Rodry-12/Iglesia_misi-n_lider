import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { PageHeading } from '../../shared/ui/page-heading';
import { CHURCH_CONTENT } from '../../core/content/church-content';

@Component({
  selector: 'app-access-page',
  imports: [RouterLink, ButtonModule, PageHeading],
  template: `
    <section class="mx-auto max-w-3xl px-4 py-12">
      <app-page-heading
        title="Acceso a gestión"
        description="Para ingresar necesitas una cuenta autorizada por la iglesia."
      />
      <p class="mb-6 text-muted">Solicita acceso al responsable de tu sede.</p>
      <a pButton [href]="'mailto:' + church.email">Solicitar acceso</a>
      <a pButton [text]="true" routerLink="/">Volver al inicio</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessPage {
  readonly church = CHURCH_CONTENT;
}
