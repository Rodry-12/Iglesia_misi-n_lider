import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MembersStore } from './members.store';
import { Notifications } from '../../core/notifications/notifications';
import { AuthStore } from '../../core/auth/auth.store';
import { calendarDate, identification, PersonDocument } from './members.models';
@Component({
  selector: 'app-person-detail-dialog',
  imports: [ButtonModule, DialogModule],
  providers: [MembersStore],
  templateUrl: './person-detail-dialog.html',
  styleUrl: './person-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonDetailDialog {
  readonly personId = input.required<string>();
  readonly closed = output<void>();
  readonly store = inject(MembersStore);
  private readonly notifications = inject(Notifications);
  private readonly auth = inject(AuthStore);
  readonly opened = computed(() => !this.store.detailLoading() && !!this.store.person());
  readonly identification = identification;
  readonly calendarDate = calendarDate;
  readonly isCurrentDocument = (document: PersonDocument) => document.isCurrent;
  constructor() {
    const identity = JSON.stringify(this.auth.session());
    effect(() => {
      if (JSON.stringify(this.auth.session()) !== identity) this.closed.emit();
    });
    effect(() => {
      const id = this.personId();
      untracked(() => this.store.loadPerson(id));
    });
    effect(() => {
      const error = this.store.detailError();
      if (!error || this.store.detailLoading()) return;
      this.notifications.error(
        error === 'not-found'
          ? 'Persona no encontrada.'
          : error === 'forbidden'
            ? 'No tienes permiso para consultar esta información.'
            : 'No fue posible consultar la ficha. Inténtalo de nuevo.',
      );
      this.closed.emit();
    });
  }
}
