import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CHURCH_CONTENT } from '../../../core/content/church-content';

@Component({
  selector: 'app-donations-page',
  templateUrl: './donations-page.html',
  styleUrl: './donations-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonationsPage {
  readonly church = CHURCH_CONTENT;
}
