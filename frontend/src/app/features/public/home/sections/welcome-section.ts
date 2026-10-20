import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PurposeSection } from './purpose-section';

@Component({
  selector: 'app-welcome-section',
  imports: [PurposeSection],
  templateUrl: './welcome-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeSection {
  readonly welcome = input.required<string>();
  readonly mission = input.required<string>();
  readonly vision = input.required<string>();
}
