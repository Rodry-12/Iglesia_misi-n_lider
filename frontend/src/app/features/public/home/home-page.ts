import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CHURCH_CONTENT } from '../../../core/content/church-content';
import { PUBLIC_REFERENCE } from '../../../core/content/public-reference-content';
import { WelcomeSection } from './sections/welcome-section';
import { WelcomeSlider } from './sections/welcome-slider';
import { BeliefsSection } from './sections/beliefs-section';
import { ValuesSection } from './sections/values-section';
import { PastorsSection } from './sections/pastors-section';
import { MinistriesSection } from './sections/ministries-section';
import { ServiceScheduleSection } from './sections/service-schedule-section';
import { EventsSection } from './sections/events-section';
import { ContactSection } from '../contact/components/contact-section';
@Component({
  selector: 'app-home-page',
  imports: [
    WelcomeSlider,
    WelcomeSection,
    BeliefsSection,
    ValuesSection,
    PastorsSection,
    MinistriesSection,
    ServiceScheduleSection,
    EventsSection,
    ContactSection,
  ],
  templateUrl: './home-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  readonly church = CHURCH_CONTENT;
  readonly reference = PUBLIC_REFERENCE;
}
