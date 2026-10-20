import { ChangeDetectionStrategy, Component } from '@angular/core';
@Component({
  selector: 'app-events-section',
  templateUrl: './events-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsSection {}
