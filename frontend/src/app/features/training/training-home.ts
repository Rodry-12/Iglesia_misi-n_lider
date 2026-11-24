import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AccessContext } from '../../core/auth/access-context';
import { ADMIN_NAVIGATION } from '../../core/navigation/admin-navigation';
import { PageHeading } from '../../shared/ui/page-heading';

@Component({
  selector: 'app-training-home',
  imports: [RouterLink, ButtonModule, PageHeading],
  template: `
    <app-page-heading
      title="Formación"
      description="Elige el área de formación que necesitas gestionar."
    />
    <div class="training-modules">
      @for (module of modules(); track module.path) {
        <section>
          <h2>{{ module.title }}</h2>
          <p>{{ descriptions[module.path] }}</p>
          <a pButton [outlined]="true" [routerLink]="module.path">{{ 'Abrir ' + module.title }}</a>
        </section>
      }
    </div>
  `,
  styles: `
    .training-modules {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
      gap: var(--ml-space-4);
    }
    section {
      padding: var(--ml-space-6);
      border: 1px solid var(--ml-color-outline);
      border-radius: var(--ml-radius-panel);
      background: var(--ml-color-surface);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--ml-space-3);
    }
    h2,
    p {
      margin: 0;
    }
    h2 {
      font-size: 1.25rem;
    }
    p {
      color: var(--ml-color-muted);
      flex: 1;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingHome {
  private readonly access = inject(AccessContext);
  readonly modules = computed(() =>
    ADMIN_NAVIGATION.find((item) => item.path === '/gestion/formacion')!.children!.filter((item) =>
      this.access.can(item.permission),
    ),
  );
  readonly descriptions: Record<string, string> = {
    '/gestion/formacion/categorias': 'Crea y organiza las categorías del catálogo de formación.',
    '/gestion/formacion/procesos': 'Crea y administra los procesos de cada categoría.',
    '/gestion/formacion/asignaciones':
      'Consulta participantes, responsables y avances de los procesos asignados.',
  };
}
