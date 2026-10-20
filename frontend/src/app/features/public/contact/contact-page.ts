import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CHURCH_CONTENT } from '../../../core/content/church-content';
import { ContactSection } from './components/contact-section';

@Component({
  selector: 'app-contact-page',
  imports: [ContactSection],
  templateUrl: './contact-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPage {
  readonly church = CHURCH_CONTENT;
}
