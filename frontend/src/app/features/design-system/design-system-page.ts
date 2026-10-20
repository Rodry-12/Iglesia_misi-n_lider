import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TableModule } from 'primeng/table';
import { LucideBuilding, LucidePalette } from '@lucide/angular';
import { PageHeading } from '../../shared/ui/page-heading';
import { ThemeToggle } from '../../shared/ui/theme-toggle';
import { SiteDraft, SiteForm } from '../../shared/forms/site-form';

@Component({
  selector: 'app-design-system-page',
  imports: [PageHeading, ThemeToggle, SiteForm, TableModule, LucideBuilding, LucidePalette],
  template: `
    <section class="mx-auto min-h-dvh max-w-6xl bg-canvas px-4 py-8 text-content">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <app-page-heading
          title="Sistema de diseño"
          description="Guía visual de Misión Líder París. Prueba el tema y valida un ejemplo de sede sin guardar información."
        />
        <app-theme-toggle />
      </div>
      <section class="mb-8" aria-labelledby="design-tokens-heading">
        <h2 id="design-tokens-heading" class="mb-3 text-xl font-semibold">Tokens compartidos</h2>
        <p class="mb-4 text-muted">
          PrimeNG, Tailwind y SCSS usan estos mismos valores. Cambia el tema para revisar su
          aplicación.
        </p>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (swatch of swatches; track swatch.token) {
            <div class="flex items-center gap-3 rounded-panel border border-outline bg-panel p-4">
              <span
                class="block h-10 w-10 shrink-0 rounded-panel border border-outline"
                [style.background]="'var(' + swatch.token + ')'"
                aria-hidden="true"
              ></span>
              <div>
                <p class="font-semibold">{{ swatch.label }}</p>
                <code class="text-xs text-muted">{{ swatch.token }}</code>
              </div>
            </div>
          }
        </div>
      </section>
      <div class="mb-6 grid gap-4 sm:grid-cols-3">
        <div class="rounded-panel bg-brand p-5" style="color: var(--ml-color-on-primary)">
          <svg lucidePalette aria-hidden="true"></svg>
          <p>Identidad</p>
        </div>
        <div class="rounded-panel border border-outline bg-panel p-5 text-content">
          Superficie y contenido
        </div>
        <div class="rounded-panel bg-brand-soft p-5 text-content">Color de apoyo</div>
      </div>
      <div class="grid gap-6 lg:grid-cols-2">
        <article class="rounded-panel border border-outline bg-panel p-6">
          <h2 class="mb-4 text-xl font-semibold">
            <svg lucideBuilding class="inline-block" aria-hidden="true"></svg> Vista previa de sede
          </h2>
          <p class="mb-5 text-muted">
            Este ejemplo valida datos; no crea una sede ni conserva información al salir.
          </p>
          <app-site-form (validated)="preview.set([$event])" (cleared)="preview.set([])" />
        </article>
        <article class="overflow-x-auto rounded-panel border border-outline bg-panel p-6">
          <h2 class="mb-4 text-xl font-semibold">Resultado de la vista previa</h2>
          <p role="status">
            {{
              preview().length
                ? 'Datos válidos. No se ha guardado información.'
                : 'Completa el formulario para ver el resultado.'
            }}
          </p>
          <p-table [value]="preview()" ariaLabel="Vista previa de sede">
            <ng-template #header
              ><tr>
                <th scope="col">Nombre</th>
                <th scope="col">Municipio</th>
              </tr></ng-template
            >
            <ng-template #body let-site
              ><tr>
                <td>{{ site.name }}</td>
                <td>{{ site.city }}</td>
              </tr></ng-template
            >
            <ng-template #emptymessage
              ><tr>
                <td colspan="2">Sin datos de vista previa.</td>
              </tr></ng-template
            >
          </p-table>
        </article>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystemPage {
  readonly swatches = [
    { label: 'Acción principal', token: '--ml-color-primary' },
    { label: 'Fondo', token: '--ml-color-background' },
    { label: 'Superficie', token: '--ml-color-surface' },
    { label: 'Contenido', token: '--ml-color-text' },
    { label: 'Error', token: '--ml-color-danger' },
    { label: 'Foco', token: '--ml-color-focus' },
  ];
  readonly preview = signal<SiteDraft[]>([]);
}
