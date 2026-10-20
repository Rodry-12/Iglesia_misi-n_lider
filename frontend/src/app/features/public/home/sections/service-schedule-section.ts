import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { ReferenceService } from '../../../../core/content/public-reference-content';
@Component({
  selector: 'app-service-schedule-section',
  templateUrl: './service-schedule-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceScheduleSection {
  readonly services = input.required<readonly ReferenceService[]>();
  readonly selected = signal<number | null>(null);
  toggle(index: number): void {
    this.selected.update((value) => (value === index ? null : index));
  }
}
