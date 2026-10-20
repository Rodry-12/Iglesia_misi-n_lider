import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ModulePreparation } from '../../shared/ui/module-preparation';
@Component({
  selector: 'app-training-page',
  imports: [ModulePreparation],
  template: `<app-module-preparation
    title="Formación"
    description="Procesos de formación, grupos y seguimiento por sede."
  />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrainingPage {}
