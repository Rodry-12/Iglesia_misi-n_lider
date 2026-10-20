import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModulePreparation } from '../../shared/ui/module-preparation';
@Component({
  selector: 'app-finance-page',
  imports: [ModulePreparation],
  template: `<app-module-preparation
    title="Finanzas"
    description="Ingresos, egresos y reportes por sede."
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancePage {}
