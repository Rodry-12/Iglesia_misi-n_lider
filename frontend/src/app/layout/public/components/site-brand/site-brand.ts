import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CHURCH_CONTENT } from '../../../../core/content/church-content';

@Component({
  selector: 'app-site-brand',
  imports: [RouterLink],
  templateUrl: './site-brand.html',
  styleUrl: './site-brand.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteBrand {
  readonly showName = input(true);
  readonly church = CHURCH_CONTENT;
}
