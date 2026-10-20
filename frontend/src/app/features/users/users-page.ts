import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModulePreparation } from '../../shared/ui/module-preparation';
@Component({
  selector: 'app-users-page',
  imports: [ModulePreparation],
  template: `<app-module-preparation
    title="Usuarios"
    description="Cuentas, roles y permisos de acceso por sede."
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage {}
