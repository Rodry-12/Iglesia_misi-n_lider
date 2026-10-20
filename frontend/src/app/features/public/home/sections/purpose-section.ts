import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-purpose-section',
  templateUrl: './purpose-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PurposeSection {
  readonly mission = input.required<string>();
  readonly vision = input.required<string>();
}
