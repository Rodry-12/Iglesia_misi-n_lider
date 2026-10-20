import { ChangeDetectionStrategy, Component } from '@angular/core';
@Component({
  selector: 'app-values-section',
  templateUrl: './values-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValuesSection {}
