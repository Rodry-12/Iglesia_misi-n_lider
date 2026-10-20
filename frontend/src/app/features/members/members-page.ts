import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModulePreparation } from '../../shared/ui/module-preparation';
@Component({
  selector: 'app-members-page',
  imports: [ModulePreparation],
  template: `<app-module-preparation
    title="Miembros"
    description="Acompañamiento y organización de la comunidad por sede."
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPage {}
