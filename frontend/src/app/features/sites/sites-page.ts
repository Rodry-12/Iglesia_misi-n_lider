import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModulePreparation } from '../../shared/ui/module-preparation';
@Component({
  selector: 'app-sites-page',
  imports: [ModulePreparation],
  template: `<app-module-preparation
    title="Sedes"
    description="Organización y configuración de las sedes de la iglesia."
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SitesPage {}
