import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CHURCH_CONTENT } from '../../../../core/content/church-content';
import { SiteBrand } from '../site-brand/site-brand';

@Component({
  selector: 'app-site-footer',
  imports: [SiteBrand],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  readonly church = CHURCH_CONTENT;
  readonly year = new Date().getFullYear();
}
