import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { Notifications } from '../../core/notifications/notifications';

/** Declarative operation feedback routed to the single application Toast. */
@Component({
  selector: 'app-toast-feedback',
  template: '',
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastFeedback {
  readonly message = input.required<string>();
  readonly severity = input<'success' | 'info' | 'warn' | 'error'>('error');
  private readonly notifications = inject(Notifications);
  constructor() {
    effect(() => {
      const message = this.message().replace(/\s+/g, ' ').trim();
      if (message) this.notifications[this.severity()](message);
    });
  }
}
